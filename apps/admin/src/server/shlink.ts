// ─── Types ───────────────────────────────────────────────────────────────────

export interface ShortUrl {
	shortCode: string;
	shortUrl: string;
	longUrl: string;
	dateCreated: string;
	title: string | null;
	tags: string[];
	crawlable: boolean;
	forwardQuery: boolean;
	hasRedirectRules: boolean;
	domain: string | null;
	visitsSummary: {
		total: number;
		nonBots: number;
		bots: number;
	};
	meta: {
		validSince: string | null;
		validUntil: string | null;
		maxVisits: number | null;
	};
}

export interface Visit {
	referer: string;
	date: string;
	userAgent: string;
	potentialBot: boolean;
	visitedUrl: string | null;
	redirectUrl: string | null;
	visitLocation: {
		cityName: string;
		countryCode: string;
		countryName: string;
		latitude: number;
		longitude: number;
		regionName: string;
		timezone: string;
	} | null;
}

export interface Pagination {
	currentPage: number;
	pagesCount: number;
	itemsPerPage: number;
	itemsInCurrentPage: number;
	totalItems: number;
}

export interface ShlinkError {
	type: string;
	title: string;
	detail: string;
	status: number;
}

export interface ListShortUrlsParams {
	page?: number;
	itemsPerPage?: number;
	searchTerm?: string;
	tags?: string[];
	orderBy?: string;
	startDate?: string;
	endDate?: string;
}

export interface CreateShortUrlParams {
	longUrl: string;
	customSlug?: string;
	title?: string;
	tags?: string[];
	crawlable?: boolean;
	forwardQuery?: boolean;
	validSince?: string | null;
	validUntil?: string | null;
	maxVisits?: number | null;
	findIfExists?: boolean;
	domain?: string;
}

export interface EditShortUrlParams {
	longUrl?: string;
	title?: string | null;
	tags?: string[];
	crawlable?: boolean;
	forwardQuery?: boolean;
	validSince?: string | null;
	validUntil?: string | null;
	maxVisits?: number | null;
}

export interface VisitsParams {
	page?: number;
	itemsPerPage?: number;
	startDate?: string;
	endDate?: string;
	excludeBots?: boolean;
}

export interface TagStats {
	tag: string;
	shortUrlsCount: number;
	visitsSummary: {
		total: number;
		nonBots: number;
		bots: number;
	};
}

export interface OverallVisitsSummary {
	nonOrphanVisits: { total: number; nonBots: number; bots: number };
	orphanVisits: { total: number; nonBots: number; bots: number };
}

import { env } from '~/server/env';
import { fetchUpstream, parseJsonResponse, readErrorBody } from '~/server/upstream-http';

// ─── Client ──────────────────────────────────────────────────────────────────

class ShlinkClient {
	private baseUrl: string;
	private apiKey: string;

	constructor() {
		this.baseUrl = env.SHLINK_URL.replace(/\/+$/, '');
		this.apiKey = env.SHLINK_API_KEY;
	}

	private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
		const res = await fetchUpstream(`${this.baseUrl}/rest/v3${path}`, {
			...options,
			headers: {
				'X-Api-Key': this.apiKey,
				'Content-Type': 'application/json',
				...options.headers,
			},
		});

		if (res.status === 204) {
			return undefined as T;
		}

		if (!res.ok) {
			const { json } = await readErrorBody(res);
			const err = json as Partial<ShlinkError> | null;
			throw new ShlinkApiError(
				err?.title ?? `Shlink request failed with status ${res.status}`,
				err?.detail ?? 'The upstream service did not provide an error description.',
				err?.status ?? res.status,
				err?.type ?? 'unknown',
			);
		}

		return parseJsonResponse<T>(res, 'Shlink');
	}

	// ─── Short URLs ────────────────────────────────────────────────────────

	async listShortUrls(params: ListShortUrlsParams = {}) {
		const query = new URLSearchParams();
		if (params.page) query.set('page', String(params.page));
		if (params.itemsPerPage) query.set('itemsPerPage', String(params.itemsPerPage));
		if (params.searchTerm) query.set('searchTerm', params.searchTerm);
		if (params.orderBy) query.set('orderBy', params.orderBy);
		if (params.startDate) query.set('startDate', params.startDate);
		if (params.endDate) query.set('endDate', params.endDate);
		if (params.tags) {
			for (const tag of params.tags) {
				query.append('tags[]', tag);
			}
		}

		const qs = query.toString();
		return this.request<{
			shortUrls: { data: ShortUrl[]; pagination: Pagination };
		}>(`/short-urls${qs ? `?${qs}` : ''}`);
	}

	async getShortUrl(shortCode: string, domain?: string) {
		const query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
		return this.request<ShortUrl>(`/short-urls/${encodeURIComponent(shortCode)}${query}`);
	}

	async createShortUrl(params: CreateShortUrlParams) {
		return this.request<ShortUrl>('/short-urls', {
			method: 'POST',
			body: JSON.stringify(params),
		});
	}

	async editShortUrl(shortCode: string, params: EditShortUrlParams, domain?: string) {
		const query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
		return this.request<ShortUrl>(`/short-urls/${encodeURIComponent(shortCode)}${query}`, {
			method: 'PATCH',
			body: JSON.stringify(params),
		});
	}

	async deleteShortUrl(shortCode: string, domain?: string) {
		const query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
		return this.request<void>(`/short-urls/${encodeURIComponent(shortCode)}${query}`, {
			method: 'DELETE',
		});
	}

	// ─── Visits ────────────────────────────────────────────────────────────

	async getOverallVisits() {
		return this.request<{ visits: OverallVisitsSummary }>('/visits');
	}

	async getShortUrlVisits(shortCode: string, params: VisitsParams = {}, domain?: string) {
		const query = new URLSearchParams();
		if (params.page) query.set('page', String(params.page));
		if (params.itemsPerPage) query.set('itemsPerPage', String(params.itemsPerPage));
		if (params.startDate) query.set('startDate', params.startDate);
		if (params.endDate) query.set('endDate', params.endDate);
		if (params.excludeBots) query.set('excludeBots', 'true');
		if (domain) query.set('domain', domain);

		const qs = query.toString();
		return this.request<{
			visits: { data: Visit[]; pagination: Pagination };
		}>(`/short-urls/${encodeURIComponent(shortCode)}/visits${qs ? `?${qs}` : ''}`);
	}

	async getNonOrphanVisits(params: VisitsParams = {}) {
		const query = new URLSearchParams();
		if (params.page) query.set('page', String(params.page));
		if (params.itemsPerPage) query.set('itemsPerPage', String(params.itemsPerPage));
		if (params.startDate) query.set('startDate', params.startDate);
		if (params.endDate) query.set('endDate', params.endDate);
		if (params.excludeBots) query.set('excludeBots', 'true');

		const qs = query.toString();
		return this.request<{
			visits: { data: Visit[]; pagination: Pagination };
		}>(`/visits/non-orphan${qs ? `?${qs}` : ''}`);
	}

	async deleteShortUrlVisits(shortCode: string, domain?: string) {
		const query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
		return this.request<{ deletedVisits: number }>(`/short-urls/${encodeURIComponent(shortCode)}/visits${query}`, { method: 'DELETE' });
	}

	// ─── Tags ──────────────────────────────────────────────────────────────

	async listTags() {
		return this.request<{
			tags: { data: string[]; pagination: Pagination };
		}>('/tags');
	}

	async listTagsWithStats(params: { page?: number; itemsPerPage?: number; searchTerm?: string; orderBy?: string } = {}) {
		const query = new URLSearchParams();
		if (params.page) query.set('page', String(params.page));
		if (params.itemsPerPage) query.set('itemsPerPage', String(params.itemsPerPage));
		if (params.searchTerm) query.set('searchTerm', params.searchTerm);
		if (params.orderBy) query.set('orderBy', params.orderBy);

		const qs = query.toString();
		return this.request<{
			tags: {
				data: TagStats[];
				pagination: Pagination;
			};
		}>(`/tags/stats${qs ? `?${qs}` : ''}`);
	}

	// ─── Health ────────────────────────────────────────────────────────────

	async health() {
		const res = await fetchUpstream(`${this.baseUrl}/rest/health`, {
			headers: { 'X-Api-Key': this.apiKey },
		});
		if (!res.ok) throw new ShlinkApiError('Shlink health check failed', '', res.status, 'health');
		return parseJsonResponse<{ status: 'pass' | 'fail'; version: string }>(res, 'Shlink');
	}
}

// ─── Error class ─────────────────────────────────────────────────────────────

export class ShlinkApiError extends Error {
	constructor(
		message: string,
		public detail: string,
		public status: number,
		public type: string,
	) {
		super(message);
		this.name = 'ShlinkApiError';
	}
}

// ─── Singleton export ────────────────────────────────────────────────────────

let _client: ShlinkClient | null = null;

export function getShlink(): ShlinkClient {
	if (!_client) {
		_client = new ShlinkClient();
	}
	return _client;
}
