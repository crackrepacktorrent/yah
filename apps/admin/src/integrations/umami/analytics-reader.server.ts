import 'server-only';
import { providerInvariantError } from '~/integrations/provider-contract.server';
import * as v from 'valibot';
import type { AnalyticsMetric, AnalyticsPeriod, AnalyticsSnapshot } from '~/features/analytics/contracts';
import type { SiteOverview, SiteOverviewPeriod } from '~/features/analytics/contracts';
import { locateUsCity } from '~/features/analytics/geography.server';
import { fetchUpstream, parseJsonResponse } from '~/integrations/http';
import { createProviderResponseParser } from '~/integrations/provider-response.server';
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
const timePointSchema = v.object({ x: v.pipe(v.string(), v.transform(normalizeTimestamp)), y: count });
const pageviewsSchema = v.object({
	pageviews: v.array(timePointSchema),
	sessions: v.array(timePointSchema),
});
const metricsSchema = v.array(pointSchema);
const citiesSchema = v.array(v.object({ city: v.nullable(v.string()), region: v.nullable(v.string()), visitors: count }));
const activeVisitorsSchema = v.object({ visitors: count });

type UmamiConfig = Pick<ProductionConfig, 'UMAMI_URL' | 'UMAMI_USERNAME' | 'UMAMI_PASSWORD' | 'UMAMI_WEBSITE_ID'>;
type RequestUpstream = typeof fetchUpstream;

type ReaderDependencies = {
	request?: RequestUpstream;
	now?: () => number;
};
const parse = createProviderResponseParser('Umami');

type PeriodRange = {
	startAt: number;
	endAt: number;
	unit: 'hour' | 'day';
};

function normalizeTimestamp(value: string): string {
	// Umami can return SQL-style timestamps without an offset. We request UTC
	// buckets, so normalize them here before browsers apply their local timezone.
	const match = /^(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))(?:[ T]((?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?)(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/.exec(value);
	if (!match || new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) !== match[1]) {
		throw providerInvariantError('Umami returned an invalid pageview timestamp.');
	}
	const explicit = `${match[1]}T${match[2] ?? '00:00:00'}${match[3] ?? 'Z'}`;
	const instant = Date.parse(explicit);
	if (!Number.isFinite(instant)) throw providerInvariantError('Umami returned an invalid pageview timestamp.');
	return new Date(instant).toISOString();
}

function periodRange(period: AnalyticsPeriod, endAt: number): PeriodRange {
	const day = 24 * 60 * 60 * 1000;
	if (period === '24h') return { startAt: endAt - day, endAt, unit: 'hour' };
	return { startAt: endAt - (period === '7d' ? 7 : 30) * day, endAt, unit: 'day' };
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
				if (!response.ok) {
					await response.body?.cancel().catch(() => undefined);
					throw providerInvariantError(`Umami authentication failed with status ${response.status}.`);
				}
				const payload = parse(loginSchema, await parseJsonResponse<unknown>(response, 'Umami'), 'authentication');
				cachedToken = { token: payload.token, expiresAt: tokenExpiry(payload.token) };
				return payload.token;
			} finally {
				tokenPromise = null;
			}
		})();

		return tokenPromise;
	}

	async function read<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
		path: string,
		params: Record<string, string> | undefined,
		schema: TSchema,
		endpoint: string,
		body?: unknown,
		retryUnauthorized = true,
	): Promise<v.InferOutput<TSchema>> {
		const token = await getToken();
		const url = new URL(`${config.UMAMI_URL}/api${path}`);
		for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

		const response = await request(url, {
			headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
			...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
		});
		if (!response.ok) await response.body?.cancel().catch(() => undefined);
		if (response.status === 401) {
			// Clear only the token rejected by this request. Another concurrent
			// request may already have installed its replacement.
			if (cachedToken?.token === token) cachedToken = null;
			if (retryUnauthorized) return read(path, params, schema, endpoint, body, false);
		}
		if (!response.ok) throw providerInvariantError(`Umami ${endpoint} request failed with status ${response.status}.`);
		return parse(schema, await parseJsonResponse<unknown>(response, 'Umami'), endpoint);
	}

	return {
		async getOverview(): Promise<SiteOverview> {
			const endAt = now();
			const day = 24 * 60 * 60 * 1000;
			const websitePath = `/websites/${encodeURIComponent(config.UMAMI_WEBSITE_ID)}`;
			const [today, month] = await Promise.all([
				read(`${websitePath}/stats`, { startAt: String(endAt - day), endAt: String(endAt) }, statsSchema, 'stats'),
				read(`${websitePath}/stats`, { startAt: String(endAt - 30 * day), endAt: String(endAt) }, statsSchema, 'stats'),
			]);
			return { today: mapOverviewPeriod(today), month: mapOverviewPeriod(month) };
		},
		async getSnapshot(period: AnalyticsPeriod): Promise<AnalyticsSnapshot> {
			const range = periodRange(period, now());
			const params = { startAt: String(range.startAt), endAt: String(range.endAt) };
			const websitePath = `/websites/${encodeURIComponent(config.UMAMI_WEBSITE_ID)}`;
			const [stats, pageviews, pages, referrers, browsers, operatingSystems, devices, countries, cities, active] = await Promise.all([
				read(`${websitePath}/stats`, params, statsSchema, 'stats'),
				read(`${websitePath}/pageviews`, { ...params, unit: range.unit, timezone: 'UTC' }, pageviewsSchema, 'pageviews'),
				read(`${websitePath}/metrics`, { ...params, type: 'path', limit: '10' }, metricsSchema, 'page metrics'),
				read(`${websitePath}/metrics`, { ...params, type: 'referrer', limit: '10' }, metricsSchema, 'referrer metrics'),
				read(`${websitePath}/metrics`, { ...params, type: 'browser', limit: '5' }, metricsSchema, 'browser metrics'),
				read(`${websitePath}/metrics`, { ...params, type: 'os', limit: '5' }, metricsSchema, 'operating-system metrics'),
				read(`${websitePath}/metrics`, { ...params, type: 'device', limit: '5' }, metricsSchema, 'device metrics'),
				read(`${websitePath}/metrics`, { ...params, type: 'country', limit: '300' }, metricsSchema, 'country metrics'),
				read('/reports/breakdown', undefined, citiesSchema, 'US city metrics', {
					websiteId: config.UMAMI_WEBSITE_ID,
					type: 'breakdown',
					parameters: { startDate: new Date(range.startAt).toISOString(), endDate: new Date(range.endAt).toISOString(), fields: ['city', 'region'] },
					filters: { ...params, country: 'eq.US' },
				}),
				read(`${websitePath}/active`, undefined, activeVisitorsSchema, 'active-visitors'),
			]);

			return {
				period,
				range: { startAt: range.startAt, endAt: range.endAt },
				stats: {
					...mapOverviewPeriod(stats),
					visits: stats.visits,
				},
				activeVisitors: active.visitors,
				pageviews: pageviews.pageviews.map(({ x, y }) => ({ timestamp: x, pageviews: y })),
				pages: mapMetrics(pages),
				referrers: mapMetrics(referrers),
				browsers: mapMetrics(browsers),
				operatingSystems: mapMetrics(operatingSystems),
				devices: mapMetrics(devices),
				cities: cities.map(({ city, region, visitors }) => locateUsCity(city ?? '', region ?? '', visitors)),
				countries: mapMetrics(countries),
			};
		},
	};
}
