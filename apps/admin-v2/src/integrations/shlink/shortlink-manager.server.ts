import 'server-only';
import * as v from 'valibot';
import {
	ShortlinkProviderFailure,
	type CreateShortlinkCommand,
	type EditableShortlink,
	type EditShortlinkCommand,
	type Shortlink,
	type ShortlinkDetail,
	type ShortlinkOverview,
	type ShortlinkVisit,
	type VisitSummary,
} from '~/features/shortlinks/contracts';
import { fetchUpstream, parseJsonResponse, readErrorBody } from '~/integrations/http';
import type { ProductionConfig } from '~/platform/config/production';

const MAX_LIST_ITEMS = 10_000;
const count = v.pipe(v.number(), v.integer(), v.minValue(0));
const nullableCount = v.nullable(count);
const httpUrl = v.pipe(
	v.string(),
	v.url(),
	v.check((value) => ['http:', 'https:'].includes(new URL(value).protocol)),
);
const dateText = v.pipe(v.string(), v.check((value) => !Number.isNaN(Date.parse(value))));
const visitSummarySchema = v.object({ total: count, nonBots: count, bots: count });
const paginationSchema = v.object({
	currentPage: count,
	pagesCount: count,
	itemsPerPage: count,
	itemsInCurrentPage: count,
	totalItems: count,
});
const shortlinkSchema = v.object({
	shortCode: v.pipe(v.string(), v.minLength(1)),
	shortUrl: httpUrl,
	longUrl: httpUrl,
	dateCreated: dateText,
	title: v.nullable(v.string()),
	tags: v.array(v.string()),
	crawlable: v.boolean(),
	forwardQuery: v.boolean(),
	hasRedirectRules: v.boolean(),
	domain: v.nullable(v.pipe(v.string(), v.minLength(1))),
	visitsSummary: visitSummarySchema,
	meta: v.object({
		maxVisits: nullableCount,
		validUntil: v.nullable(dateText),
	}),
});
const shortlinkListSchema = v.object({
	shortUrls: v.object({ data: v.array(shortlinkSchema), pagination: paginationSchema }),
});
const locationSchema = v.object({ cityName: v.string(), countryCode: v.string(), countryName: v.string() });
const visitSchema = v.object({
	referer: v.string(),
	date: dateText,
	userAgent: v.string(),
	potentialBot: v.boolean(),
	visitLocation: v.nullable(locationSchema),
});
const visitsSchema = v.object({
	visits: v.object({ data: v.array(visitSchema), pagination: paginationSchema }),
});
const deletedVisitsSchema = v.object({ deletedVisits: count });
const overallVisitsSchema = v.object({
	visits: v.object({ nonOrphanVisits: visitSummarySchema, orphanVisits: visitSummarySchema }),
});
const nonUniqueSlugProblemSchema = v.object({
	type: v.literal('https://shlink.io/api/error/non-unique-slug'),
});

type ShlinkConfig = Pick<ProductionConfig, 'SHLINK_URL' | 'SHLINK_API_KEY'>;
type RequestUpstream = typeof fetchUpstream;

function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
	schema: TSchema,
	input: unknown,
	endpoint: string,
): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, input);
	if (!result.success) throw new Error(`Shlink returned an invalid ${endpoint} response.`);
	return result.output;
}

function normalizeSummary(summary: v.InferOutput<typeof visitSummarySchema>): VisitSummary {
	return { total: summary.total, nonBots: summary.nonBots, bots: summary.bots };
}

function normalizeShortlink(value: v.InferOutput<typeof shortlinkSchema>): Shortlink {
	if (value.domain !== null) {
		throw new Error('Shlink custom-domain shortlinks are not supported by this admin route model.');
	}
	if (value.hasRedirectRules) {
		throw new Error('Shlink redirect-rule shortlinks are not supported by this admin route model.');
	}
	return {
		shortCode: value.shortCode,
		shortUrl: value.shortUrl,
		longUrl: value.longUrl,
		dateCreated: value.dateCreated,
		title: value.title,
		tags: [...value.tags],
		crawlable: value.crawlable,
		forwardQuery: value.forwardQuery,
		visits: normalizeSummary(value.visitsSummary),
		maxVisits: value.meta.maxVisits,
		validUntil: value.meta.validUntil,
	};
}

function normalizeVisit(value: v.InferOutput<typeof visitSchema>): ShortlinkVisit {
	return {
		referer: value.referer,
		date: value.date,
		userAgent: value.userAgent,
		location: value.visitLocation
			? { city: value.visitLocation.cityName, countryCode: value.visitLocation.countryCode, country: value.visitLocation.countryName }
			: null,
	};
}

function editableShortlink(shortlink: Shortlink): EditableShortlink {
	return {
		shortCode: shortlink.shortCode,
		longUrl: shortlink.longUrl,
		title: shortlink.title,
		tags: [...shortlink.tags],
		crawlable: shortlink.crawlable,
		forwardQuery: shortlink.forwardQuery,
		maxVisits: shortlink.maxVisits,
		validUntil: shortlink.validUntil,
	};
}

export function createShlinkShortlinkManager(config: ShlinkConfig, request: RequestUpstream = fetchUpstream) {
	const baseUrl = `${config.SHLINK_URL.replace(/\/+$/, '')}/rest/v3`;

	async function call<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
		path: string,
		schema: TSchema | undefined,
		endpoint: string,
		init: RequestInit = {},
	): Promise<v.InferOutput<TSchema>> {
		const response = await request(`${baseUrl}${path}`, {
			...init,
			headers: {
				Accept: 'application/json',
				'X-Api-Key': config.SHLINK_API_KEY,
				...(init.body ? { 'Content-Type': 'application/json' } : {}),
				...init.headers,
			},
		});
		if (!response.ok) {
			const body = await readErrorBody(response);
			const problemType = v.safeParse(nonUniqueSlugProblemSchema, body.json).success ? 'non-unique-slug' : null;
			throw new ShortlinkProviderFailure(response.status, problemType);
		}
		if (response.status === 204 || !schema) return undefined as v.InferOutput<TSchema>;
		return parse(schema, await parseJsonResponse<unknown>(response, 'Shlink'), endpoint);
	}

	async function listPage(itemsPerPage: number) {
		const query = new URLSearchParams({ itemsPerPage: String(itemsPerPage), orderBy: 'dateCreated-DESC' });
		return call(`/short-urls?${query}`, shortlinkListSchema, 'shortlink-list');
	}

	async function get(shortCode: string): Promise<Shortlink | null> {
		try {
			return normalizeShortlink(await call(`/short-urls/${encodeURIComponent(shortCode)}`, shortlinkSchema, 'shortlink'));
		} catch (error) {
			if (error instanceof ShortlinkProviderFailure && error.status === 404) return null;
			throw error;
		}
	}

	return {
		async list(): Promise<Shortlink[]> {
			const result = await listPage(MAX_LIST_ITEMS);
			const { data, pagination } = result.shortUrls;
			if (pagination.pagesCount > 1 || pagination.totalItems > data.length || data.length > MAX_LIST_ITEMS) {
				throw new Error(`Shlink returned more than the ${MAX_LIST_ITEMS.toLocaleString('en-US')}-link safety cap.`);
			}
			return data.map(normalizeShortlink);
		},
		async getEditable(shortCode: string): Promise<EditableShortlink | null> {
			const shortlink = await get(shortCode);
			return shortlink ? editableShortlink(shortlink) : null;
		},
		async getDetail(shortCode: string): Promise<ShortlinkDetail | null> {
			const shortlink = await get(shortCode);
			if (!shortlink) return null;
			const query = new URLSearchParams({ itemsPerPage: '20', excludeBots: 'true' });
			const result = await call(
				`/short-urls/${encodeURIComponent(shortCode)}/visits?${query}`,
				visitsSchema,
				'shortlink-visits',
			);
			return {
				shortlink,
				recentVisits: result.visits.data.map(normalizeVisit),
				totalVisits: result.visits.pagination.totalItems,
			};
		},
		async create(input: CreateShortlinkCommand): Promise<{ shortCode: string }> {
			const result = await call('/short-urls', shortlinkSchema, 'created-shortlink', {
				method: 'POST',
				body: JSON.stringify({
					longUrl: input.longUrl,
					customSlug: input.customSlug || undefined,
					title: input.title || undefined,
					tags: input.tags.length ? input.tags : undefined,
					maxVisits: input.maxVisits,
					validUntil: input.validUntil || undefined,
					crawlable: input.crawlable,
					forwardQuery: input.forwardQuery,
				}),
			});
			return { shortCode: result.shortCode };
		},
		async edit(input: EditShortlinkCommand): Promise<void> {
			await call(`/short-urls/${encodeURIComponent(input.shortCode)}`, shortlinkSchema, 'edited-shortlink', {
				method: 'PATCH',
				body: JSON.stringify({
					longUrl: input.longUrl,
					title: input.title || null,
					tags: input.tags,
					maxVisits: input.maxVisits,
					validUntil: input.validUntil || null,
					crawlable: input.crawlable,
					forwardQuery: input.forwardQuery,
				}),
			});
		},
		async delete(shortCode: string): Promise<void> {
			await call(`/short-urls/${encodeURIComponent(shortCode)}`, undefined, 'deleted-shortlink', { method: 'DELETE' });
		},
		async resetVisits(shortCode: string): Promise<{ deletedCount: number }> {
			const result = await call(
				`/short-urls/${encodeURIComponent(shortCode)}/visits`,
				deletedVisitsSchema,
				'deleted-shortlink-visits',
				{ method: 'DELETE' },
			);
			return { deletedCount: result.deletedVisits };
		},
		async getOverview(): Promise<ShortlinkOverview> {
			const [recent, overall] = await Promise.all([
				listPage(5),
				call('/visits', overallVisitsSchema, 'overall-visits'),
			]);
			return {
				totalShortlinks: recent.shortUrls.pagination.totalItems,
				visits: normalizeSummary(overall.visits.nonOrphanVisits),
				recentShortlinks: recent.shortUrls.data.map(normalizeShortlink),
			};
		},
	};
}
