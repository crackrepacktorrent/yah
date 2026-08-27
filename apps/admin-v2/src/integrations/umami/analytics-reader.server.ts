import 'server-only';
import * as v from 'valibot';
import type { AnalyticsMetric, AnalyticsPeriod, AnalyticsSnapshot } from '~/features/analytics/contracts';
import type { SiteOverview, SiteOverviewPeriod } from '~/features/analytics/contracts';
import { fetchUpstream, parseJsonResponse } from '~/integrations/http';
import type { ProductionConfig } from '~/platform/config/production';

const EARLY_EXPIRY_MS = 5 * 60 * 1000;
const FALLBACK_TTL_MS = 23 * 60 * 60 * 1000;

const count = v.pipe(v.number(), v.finite(), v.minValue(0));
const loginSchema = v.object({ token: v.pipe(v.string(), v.minLength(1)) });
const statsSchema = v.object({
	pageviews: count,
	visitors: count,
	visits: count,
	bounces: count,
	totaltime: count,
});
const pointSchema = v.object({ x: v.string(), y: count });
const pageviewsSchema = v.object({
	pageviews: v.array(pointSchema),
	sessions: v.array(pointSchema),
});
const metricsSchema = v.array(pointSchema);
const activeVisitorsSchema = v.object({ visitors: count });

type UmamiConfig = Pick<ProductionConfig, 'UMAMI_URL' | 'UMAMI_USERNAME' | 'UMAMI_PASSWORD' | 'UMAMI_WEBSITE_ID'>;
type RequestUpstream = typeof fetchUpstream;

type ReaderDependencies = {
	request?: RequestUpstream;
	now?: () => number;
};

type PeriodRange = {
	startAt: number;
	endAt: number;
	unit: 'hour' | 'day';
};

function periodRange(period: AnalyticsPeriod, endAt: number): PeriodRange {
	const day = 24 * 60 * 60 * 1000;
	if (period === '24h') return { startAt: endAt - day, endAt, unit: 'hour' };
	return { startAt: endAt - (period === '7d' ? 7 : 30) * day, endAt, unit: 'day' };
}

function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
	schema: TSchema,
	input: unknown,
	endpoint: string,
): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, input);
	if (!result.success) throw new Error(`Umami returned an invalid ${endpoint} response.`);
	return result.output;
}

function decodeBase64Url(value: string): string {
	const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
	return atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
}

function mapMetrics(metrics: v.InferOutput<typeof metricsSchema>): AnalyticsMetric[] {
	return metrics.map(({ x, y }) => ({ label: x, visitors: y }));
}

function mapOverviewPeriod(stats: v.InferOutput<typeof statsSchema>): SiteOverviewPeriod {
	return {
		pageviews: stats.pageviews,
		visitors: stats.visitors,
		bounceRate: stats.visits > 0 ? Math.round((stats.bounces / stats.visits) * 100) : 0,
		averageVisitSeconds: stats.visits > 0 ? Math.round(stats.totaltime / stats.visits) : 0,
	};
}

export function createUmamiAnalyticsReader(config: UmamiConfig, dependencies: ReaderDependencies = {}) {
	const request = dependencies.request ?? fetchUpstream;
	const now = dependencies.now ?? Date.now;
	let cachedToken: { token: string; expiresAt: number } | null = null;
	let tokenPromise: Promise<string> | null = null;

	function tokenExpiry(token: string): number {
		try {
			const encodedPayload = token.split('.')[1];
			if (!encodedPayload) return now() + FALLBACK_TTL_MS;
			const payload = JSON.parse(decodeBase64Url(encodedPayload)) as { exp?: unknown };
			return typeof payload.exp === 'number' ? payload.exp * 1000 - EARLY_EXPIRY_MS : now() + FALLBACK_TTL_MS;
		} catch {
			return now() + FALLBACK_TTL_MS;
		}
	}

	async function getToken(): Promise<string> {
		if (cachedToken && now() < cachedToken.expiresAt) return cachedToken.token;
		if (tokenPromise) return tokenPromise;

		tokenPromise = (async () => {
			try {
				const response = await request(`${config.UMAMI_URL}/api/auth/login`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ username: config.UMAMI_USERNAME, password: config.UMAMI_PASSWORD }),
				});
				if (!response.ok) throw new Error(`Umami authentication failed with status ${response.status}.`);
				const payload = parse(loginSchema, await parseJsonResponse<unknown>(response, 'Umami'), 'authentication');
				cachedToken = { token: payload.token, expiresAt: tokenExpiry(payload.token) };
				return payload.token;
			} finally {
				tokenPromise = null;
			}
		})();

		return tokenPromise;
	}

	async function get<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
		path: string,
		params: Record<string, string> | undefined,
		schema: TSchema,
		endpoint: string,
		retryUnauthorized = true,
	): Promise<v.InferOutput<TSchema>> {
		const token = await getToken();
		const url = new URL(`${config.UMAMI_URL}/api${path}`);
		for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

		const response = await request(url, { headers: { Authorization: `Bearer ${token}` } });
		if (response.status === 401) {
			// Clear only the token rejected by this request. Another concurrent
			// request may already have installed its replacement.
			if (cachedToken?.token === token) cachedToken = null;
			if (retryUnauthorized) return get(path, params, schema, endpoint, false);
		}
		if (!response.ok) throw new Error(`Umami ${endpoint} request failed with status ${response.status}.`);
		return parse(schema, await parseJsonResponse<unknown>(response, 'Umami'), endpoint);
	}

	return {
		async getOverview(): Promise<SiteOverview> {
			const endAt = now();
			const day = 24 * 60 * 60 * 1000;
			const websitePath = `/websites/${encodeURIComponent(config.UMAMI_WEBSITE_ID)}`;
			const [today, month] = await Promise.all([
				get(`${websitePath}/stats`, { startAt: String(endAt - day), endAt: String(endAt) }, statsSchema, 'stats'),
				get(`${websitePath}/stats`, { startAt: String(endAt - 30 * day), endAt: String(endAt) }, statsSchema, 'stats'),
			]);
			return { today: mapOverviewPeriod(today), month: mapOverviewPeriod(month) };
		},
		async getSnapshot(period: AnalyticsPeriod): Promise<AnalyticsSnapshot> {
			const range = periodRange(period, now());
			const params = { startAt: String(range.startAt), endAt: String(range.endAt) };
			const websitePath = `/websites/${encodeURIComponent(config.UMAMI_WEBSITE_ID)}`;
			const [stats, pageviews, pages, referrers, browsers, operatingSystems, devices, cities, active] = await Promise.all([
				get(`${websitePath}/stats`, params, statsSchema, 'stats'),
				get(`${websitePath}/pageviews`, { ...params, unit: range.unit }, pageviewsSchema, 'pageviews'),
				get(`${websitePath}/metrics`, { ...params, type: 'path', limit: '10' }, metricsSchema, 'page metrics'),
				get(`${websitePath}/metrics`, { ...params, type: 'referrer', limit: '10' }, metricsSchema, 'referrer metrics'),
				get(`${websitePath}/metrics`, { ...params, type: 'browser', limit: '5' }, metricsSchema, 'browser metrics'),
				get(`${websitePath}/metrics`, { ...params, type: 'os', limit: '5' }, metricsSchema, 'operating-system metrics'),
				get(`${websitePath}/metrics`, { ...params, type: 'device', limit: '5' }, metricsSchema, 'device metrics'),
				get(`${websitePath}/metrics`, { ...params, type: 'city', limit: '15' }, metricsSchema, 'city metrics'),
				get(`${websitePath}/active`, undefined, activeVisitorsSchema, 'active-visitors'),
			]);

			return {
				period,
				stats: {
					pageviews: stats.pageviews,
					visitors: stats.visitors,
					visits: stats.visits,
					bounceRate: stats.visits > 0 ? Math.round((stats.bounces / stats.visits) * 100) : 0,
					averageVisitSeconds: stats.visits > 0 ? Math.round(stats.totaltime / stats.visits) : 0,
				},
				activeVisitors: active.visitors,
				pageviews: pageviews.pageviews.map(({ x, y }) => ({ timestamp: x, pageviews: y })),
				pages: mapMetrics(pages),
				referrers: mapMetrics(referrers),
				browsers: mapMetrics(browsers),
				operatingSystems: mapMetrics(operatingSystems),
				devices: mapMetrics(devices),
				cities: mapMetrics(cities),
			};
		},
	};
}
