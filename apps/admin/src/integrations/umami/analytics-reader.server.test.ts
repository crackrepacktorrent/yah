import { describe, expect, it, vi } from 'vitest';
import { createUmamiAnalyticsReader } from './analytics-reader.server';

const fixedNow = Date.UTC(2026, 7, 26, 12);
const config = {
	UMAMI_URL: 'https://analytics.example',
	UMAMI_USERNAME: 'analytics-user',
	UMAMI_PASSWORD: 'analytics-password',
	UMAMI_WEBSITE_ID: 'website/id',
};

function json(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function token(label: string): string {
	const payload = Buffer.from(JSON.stringify({ exp: Math.floor(fixedNow / 1000) + 86_400 })).toString('base64url');
	return `header.${payload}.${label}`;
}

function successfulPayload(url: URL): Response {
	if (url.pathname.endsWith('/stats')) {
		return json({ pageviews: 100, visitors: 40, visits: 50, bounces: 10, totaltime: 6_250 });
	}
	if (url.pathname.endsWith('/pageviews')) {
		return json({ pageviews: [{ x: '2026-08-26T12:00:00Z', y: 12 }], sessions: [{ x: '2026-08-26T12:00:00Z', y: 8 }] });
	}
	if (url.pathname.endsWith('/metrics')) {
		return json([{ x: url.searchParams.get('type') ?? '', y: 7 }]);
	}
	if (url.pathname.endsWith('/active')) return json({ visitors: 3 });
	throw new Error(`Unexpected fixture URL: ${url}`);
}

describe('Umami analytics reader', () => {
	it('loads the dashboard with only two stats requests and one shared login', async () => {
		let logins = 0;
		const requests: URL[] = [];
		const request = vi.fn(async (input: string | URL) => {
			const url = new URL(input);
			requests.push(url);
			if (url.pathname === '/api/auth/login') {
				logins += 1;
				return json({ token: token('overview') });
			}
			return successfulPayload(url);
		});
		const reader = createUmamiAnalyticsReader(config, { request, now: () => fixedNow });

		await expect(reader.getOverview()).resolves.toEqual({
			today: { pageviews: 100, visitors: 40, bounceRate: 20, averageVisitSeconds: 125 },
			month: { pageviews: 100, visitors: 40, bounceRate: 20, averageVisitSeconds: 125 },
		});
		expect(logins).toBe(1);
		const apiRequests = requests.filter(({ pathname }) => pathname !== '/api/auth/login');
		expect(apiRequests).toHaveLength(2);
		expect(apiRequests.every(({ pathname }) => pathname.endsWith('/stats'))).toBe(true);
		expect(apiRequests.map((url) => Number(url.searchParams.get('startAt'))).sort()).toEqual(
			[fixedNow - 30 * 24 * 60 * 60 * 1000, fixedNow - 24 * 60 * 60 * 1000].sort(),
		);
	});

	it('uses one token and normalizes the exact analytics endpoint contract', async () => {
		const requests: Array<{ url: URL; init?: RequestInit }> = [];
		const request = vi.fn(async (input: string | URL, init?: RequestInit) => {
			const url = new URL(input);
			requests.push({ url, init });
			if (url.pathname === '/api/auth/login') return json({ token: token('normal') });
			return successfulPayload(url);
		});
		const reader = createUmamiAnalyticsReader(config, { request, now: () => fixedNow });

		const result = await reader.getSnapshot('7d');

		expect(result).toMatchObject({
			period: '7d',
			stats: { pageviews: 100, visitors: 40, visits: 50, bounceRate: 20, averageVisitSeconds: 125 },
			activeVisitors: 3,
			pageviews: [{ timestamp: '2026-08-26T12:00:00Z', pageviews: 12 }],
			pages: [{ label: 'path', visitors: 7 }],
			operatingSystems: [{ label: 'os', visitors: 7 }],
		});
		expect(requests.filter(({ url }) => url.pathname === '/api/auth/login')).toHaveLength(1);
		const login = requests.find(({ url }) => url.pathname === '/api/auth/login');
		expect(login?.init).toMatchObject({
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		});
		expect(JSON.parse(String(login?.init?.body))).toEqual({
			username: config.UMAMI_USERNAME,
			password: config.UMAMI_PASSWORD,
		});
		const apiRequests = requests.filter(({ url }) => url.pathname !== '/api/auth/login');
		expect(apiRequests).toHaveLength(9);
		for (const { init } of apiRequests) expect(init?.headers).toEqual({ Authorization: `Bearer ${token('normal')}` });

		const pageviews = apiRequests.find(({ url }) => url.pathname.endsWith('/pageviews'))?.url;
		expect(pageviews?.pathname).toBe('/api/websites/website%2Fid/pageviews');
		expect(pageviews?.searchParams.get('startAt')).toBe(String(fixedNow - 7 * 24 * 60 * 60 * 1000));
		expect(pageviews?.searchParams.get('endAt')).toBe(String(fixedNow));
		expect(pageviews?.searchParams.get('unit')).toBe('day');

		const metricLimits = Object.fromEntries(
			apiRequests
				.filter(({ url }) => url.pathname.endsWith('/metrics'))
				.map(({ url }) => [url.searchParams.get('type'), url.searchParams.get('limit')]),
		);
		expect(metricLimits).toEqual({ path: '10', referrer: '10', browser: '5', os: '5', device: '5', city: '15' });
	});

	it('deduplicates login across concurrent snapshots and uses each period range', async () => {
		let logins = 0;
		const observedPageviews: URL[] = [];
		const request = vi.fn(async (input: string | URL) => {
			const url = new URL(input);
			if (url.pathname === '/api/auth/login') {
				logins += 1;
				return json({ token: token('shared') });
			}
			if (url.pathname.endsWith('/pageviews')) observedPageviews.push(url);
			return successfulPayload(url);
		});
		const reader = createUmamiAnalyticsReader(config, { request, now: () => fixedNow });

		await Promise.all([reader.getSnapshot('24h'), reader.getSnapshot('30d')]);

		expect(logins).toBe(1);
		expect(observedPageviews).toHaveLength(2);
		expect(observedPageviews.map((url) => url.searchParams.get('unit')).sort()).toEqual(['day', 'hour']);
		expect(observedPageviews.map((url) => Number(url.searchParams.get('startAt'))).sort()).toEqual(
			[fixedNow - 30 * 24 * 60 * 60 * 1000, fixedNow - 24 * 60 * 60 * 1000].sort(),
		);
	});

	it('shares one replacement login when concurrent requests reject the used token', async () => {
		let logins = 0;
		const request = vi.fn(async (input: string | URL, init?: RequestInit) => {
			const url = new URL(input);
			if (url.pathname === '/api/auth/login') {
				logins += 1;
				return json({ token: token(`login-${logins}`) });
			}
			const authorization = (init?.headers as Record<string, string> | undefined)?.['Authorization'];
			if (authorization === `Bearer ${token('login-1')}`) return json({ error: 'revoked' }, 401);
			return successfulPayload(url);
		});
		const reader = createUmamiAnalyticsReader(config, { request, now: () => fixedNow });

		await expect(reader.getSnapshot('7d')).resolves.toMatchObject({ period: '7d' });
		expect(logins).toBe(2);
	});

	it('does not clear a replacement token when a late request rejects the old token', async () => {
		let logins = 0;
		let releaseLateUnauthorized: (() => void) | undefined;
		let replacementPageviewRequests = 0;
		const lateUnauthorized = new Promise<Response>((resolve) => {
			releaseLateUnauthorized = () => resolve(json({ error: 'late revocation' }, 401));
		});
		const request = vi.fn(async (input: string | URL, init?: RequestInit) => {
			const url = new URL(input);
			if (url.pathname === '/api/auth/login') {
				logins += 1;
				return json({ token: token(`race-${logins}`) });
			}
			const authorization = (init?.headers as Record<string, string> | undefined)?.['Authorization'];
			if (authorization === `Bearer ${token('race-1')}` && url.pathname.endsWith('/stats')) {
				return json({ error: 'revoked' }, 401);
			}
			if (authorization === `Bearer ${token('race-1')}` && url.pathname.endsWith('/pageviews')) {
				return lateUnauthorized;
			}
			if (authorization === `Bearer ${token('race-2')}` && url.pathname.endsWith('/pageviews')) {
				replacementPageviewRequests += 1;
			}
			return successfulPayload(url);
		});
		const reader = createUmamiAnalyticsReader(config, { request, now: () => fixedNow });

		const snapshot = reader.getSnapshot('7d');
		await vi.waitFor(() => expect(logins).toBe(2));
		releaseLateUnauthorized?.();

		await expect(snapshot).resolves.toMatchObject({ period: '7d' });
		expect(replacementPageviewRequests).toBe(1);
		expect(logins).toBe(2);
	});

	it('retries unauthorized requests only once', async () => {
		let logins = 0;
		const request = vi.fn(async (input: string | URL) => {
			const url = new URL(input);
			if (url.pathname === '/api/auth/login') {
				logins += 1;
				return json({ token: token(`rejected-${logins}`) });
			}
			return json({ error: 'still revoked' }, 401);
		});
		const reader = createUmamiAnalyticsReader(config, { request, now: () => fixedNow });

		await expect(reader.getSnapshot('7d')).rejects.toThrow('status 401');
		expect(logins).toBe(2);
	});

	it('returns zero rates when there are no visits', async () => {
		const request = vi.fn(async (input: string | URL) => {
			const url = new URL(input);
			if (url.pathname === '/api/auth/login') return json({ token: token('zero') });
			if (url.pathname.endsWith('/stats')) {
				return json({ pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0 });
			}
			return successfulPayload(url);
		});
		const reader = createUmamiAnalyticsReader(config, { request, now: () => fixedNow });

		expect((await reader.getSnapshot('24h')).stats).toMatchObject({ bounceRate: 0, averageVisitSeconds: 0 });
	});

	it.each([
		['missing login token', () => json({ user: { id: 'no-token' } }), /invalid authentication response/],
		['HTML success response', () => new Response('<html>oops</html>', { headers: { 'content-type': 'text/html' } }), /expected JSON/],
		['invalid endpoint DTO', () => json({ pageviews: 'many' }), /invalid stats response/],
	] as const)('fails closed for a %s', async (_label, failure, expected) => {
		const request = vi.fn(async (input: string | URL) => {
			const url = new URL(input);
			if (url.pathname === '/api/auth/login') {
				return _label === 'missing login token' ? failure() : json({ token: token('invalid') });
			}
			if (url.pathname.endsWith('/stats')) return failure();
			return successfulPayload(url);
		});
		const reader = createUmamiAnalyticsReader(config, { request, now: () => fixedNow });

		await expect(reader.getSnapshot('7d')).rejects.toThrow(expected);
	});

	it('does not copy credentials or an upstream body into authentication errors', async () => {
		const request = vi.fn(async () => new Response(`rejected ${config.UMAMI_PASSWORD}`, { status: 403 }));
		const reader = createUmamiAnalyticsReader(config, { request, now: () => fixedNow });

		const error = await reader.getSnapshot('7d').catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(Error);
		expect(String(error)).not.toContain(config.UMAMI_PASSWORD);
		expect(String(error)).not.toContain('rejected');
	});
});
