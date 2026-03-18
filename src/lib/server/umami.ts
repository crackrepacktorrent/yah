import { env } from '$env/dynamic/private';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
	if (cachedToken && Date.now() < cachedToken.expiresAt) {
		return cachedToken.token;
	}

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
}

function decodeBase64Url(str: string): string {
	// base64url → base64: replace URL-safe chars and pad
	const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
	return atob(padded);
}

function getJwtExpiry(token: string): number {
	try {
		const payload = JSON.parse(decodeBase64Url(token.split('.')[1]));
		// Expire 5 minutes early to avoid using stale tokens
		return payload.exp ? payload.exp * 1000 - 5 * 60 * 1000 : Date.now() + 23 * 60 * 60 * 1000;
	} catch {
		return Date.now() + 23 * 60 * 60 * 1000;
	}
}

function init() {
	if (!env.UMAMI_URL || !env.UMAMI_USERNAME || !env.UMAMI_PASSWORD || !env.UMAMI_WEBSITE_ID) {
		throw new Error('UMAMI_URL, UMAMI_USERNAME, UMAMI_PASSWORD, and UMAMI_WEBSITE_ID must be set');
	}
}

function getWebsiteId(): string {
	return env.UMAMI_WEBSITE_ID!;
}

async function umamiGet(path: string, params?: Record<string, string>): Promise<any> {
	const token = await getToken();
	const url = new URL(`${env.UMAMI_URL}/api${path}`);
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
	init();
	return umamiGet(`/websites/${getWebsiteId()}/stats`, {
		startAt: String(startAt),
		endAt: String(endAt),
	});
}

export async function getPageviews(
	startAt: number,
	endAt: number,
	unit: 'hour' | 'day' | 'week' | 'month' = 'day',
): Promise<{ pageviews: UmamiPageview[]; sessions: UmamiPageview[] }> {
	init();
	return umamiGet(`/websites/${getWebsiteId()}/pageviews`, {
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
	init();
	return umamiGet(`/websites/${getWebsiteId()}/metrics`, {
		startAt: String(startAt),
		endAt: String(endAt),
		type,
		limit: String(limit),
	});
}

export async function getActiveVisitors(): Promise<number> {
	init();
	const data = await umamiGet(`/websites/${getWebsiteId()}/active`);
	return data.visitors;
}
