import { env } from '~/server/env';

let cachedToken: { token: string; expiresAt: number } | null = null;
let tokenPromise: Promise<string> | null = null;

async function getToken(): Promise<string> {
	if (cachedToken && Date.now() < cachedToken.expiresAt) {
		return cachedToken.token;
	}

	if (tokenPromise) return tokenPromise;

	tokenPromise = (async () => {
		try {
			const res = await fetch(`${env.UMAMI_URL}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: env.UMAMI_USERNAME,
					password: env.UMAMI_PASSWORD,
				}),
			});

			if (!res.ok) {
				throw new Error(`Umami auth failed: ${res.status}`);
			}

			const data = await res.json();
			cachedToken = { token: data.token, expiresAt: getJwtExpiry(data.token) };
			return data.token;
		} finally {
			tokenPromise = null;
		}
	})();

	return tokenPromise;
}

function decodeBase64Url(str: string): string {
	const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
	return atob(padded);
}

function getJwtExpiry(token: string): number {
	try {
		const payload = JSON.parse(decodeBase64Url(token.split('.')[1]!));
		const EARLY_EXPIRY_MS = 5 * 60 * 1000; // Refresh 5 min before expiry
		const FALLBACK_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours if no exp claim
		return payload.exp ? payload.exp * 1000 - EARLY_EXPIRY_MS : Date.now() + FALLBACK_TTL_MS;
	} catch {
		return Date.now() + 23 * 60 * 60 * 1000;
	}
}

function getWebsiteId(): string {
	return env.UMAMI_WEBSITE_ID;
}

async function umamiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
	const token = await getToken();
	const url = new URL(`${process.env['UMAMI_URL']}/api${path}`);
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			url.searchParams.set(k, v);
		}
	}

	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${token}` },
	});

	if (!res.ok) {
		throw new Error(`Umami API error: ${res.status} ${await res.text()}`);
	}

	return res.json();
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function bounceRate(stats: UmamiStats): number {
	return stats.visits > 0 ? Math.round((stats.bounces / stats.visits) * 100) : 0;
}

export function avgVisitTime(stats: UmamiStats): number {
	return stats.visits > 0 ? Math.round(stats.totaltime / stats.visits) : 0;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface UmamiStats {
	pageviews: number;
	visitors: number;
	visits: number;
	bounces: number;
	totaltime: number;
}

export interface UmamiMetric {
	x: string;
	y: number;
}

export interface UmamiPageview {
	x: string;
	y: number;
}

export async function getWebsiteStats(startAt: number, endAt: number): Promise<UmamiStats> {
	return umamiGet<UmamiStats>(`/websites/${getWebsiteId()}/stats`, {
		startAt: String(startAt),
		endAt: String(endAt),
	});
}

export async function getPageviews(
	startAt: number,
	endAt: number,
	unit: 'hour' | 'day' | 'week' | 'month' = 'day',
): Promise<{ pageviews: UmamiPageview[]; sessions: UmamiPageview[] }> {
	return umamiGet<{ pageviews: UmamiPageview[]; sessions: UmamiPageview[] }>(`/websites/${getWebsiteId()}/pageviews`, {
		startAt: String(startAt),
		endAt: String(endAt),
		unit,
	});
}

export type MetricType =
	| 'path'
	| 'referrer'
	| 'browser'
	| 'os'
	| 'device'
	| 'country'
	| 'city';

export async function getMetrics(
	startAt: number,
	endAt: number,
	type: MetricType,
	limit = 10,
): Promise<UmamiMetric[]> {
	return umamiGet<UmamiMetric[]>(`/websites/${getWebsiteId()}/metrics`, {
		startAt: String(startAt),
		endAt: String(endAt),
		type,
		limit: String(limit),
	});
}

export async function getActiveVisitors(): Promise<number> {
	const data = await umamiGet<{ visitors: number }>(`/websites/${getWebsiteId()}/active`);
	return data.visitors;
}
