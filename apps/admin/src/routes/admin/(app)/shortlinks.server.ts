import { query } from '@solidjs/router';
import { getShlink, ShlinkApiError } from '~/server/shlink';
import { withPermissions, HttpError } from '~/server/auth-helpers';

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listShortUrls = query(async () => {
	'use server';
	return withPermissions({ shortlink: ['view'] }, async () => {
		const res = await getShlink().listShortUrls({ itemsPerPage: 10000, orderBy: 'dateCreated-DESC' });
		return res.shortUrls.data;
	});
}, 'listShortUrls');

export const getShortUrl = query(async (shortCode: string) => {
	'use server';
	return withPermissions({ shortlink: ['view'] }, async () => {
		try {
			return await getShlink().getShortUrl(shortCode);
		} catch (err) {
			if (err instanceof ShlinkApiError && err.status === 404) {
				throw new HttpError('Shortlink not found', 404);
			}
			throw err;
		}
	});
}, 'getShortUrl');

export const getShortUrlVisits = query(async (shortCode: string) => {
	'use server';
	return withPermissions({ shortlink: ['view'] }, async () => {
		const res = await getShlink().getShortUrlVisits(shortCode, { itemsPerPage: 20, excludeBots: true });
		return { visits: res.visits.data, pagination: res.visits.pagination };
	});
}, 'getShortUrlVisits');

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createShortUrl(data: {
	longUrl: string;
	customSlug?: string;
	title?: string;
	tags: string[];
	maxVisits: number | null;
	validUntil?: string;
	crawlable: boolean;
	forwardQuery: boolean;
}): Promise<{ shortCode: string }> {
	'use server';
	return withPermissions({ shortlink: ['create'] }, async () => {
		const result = await getShlink().createShortUrl({
			longUrl: data.longUrl,
			customSlug: data.customSlug || undefined,
			title: data.title || undefined,
			tags: data.tags.length > 0 ? data.tags : undefined,
			crawlable: data.crawlable,
			forwardQuery: data.forwardQuery,
			maxVisits: data.maxVisits,
			validUntil: data.validUntil || undefined,
		});
		return { shortCode: result.shortCode };
	});
}

export async function editShortUrl(data: {
	shortCode: string;
	longUrl: string;
	title?: string;
	tags: string[];
	maxVisits: number | null;
	validUntil?: string;
	crawlable: boolean;
	forwardQuery: boolean;
}): Promise<void> {
	'use server';
	return withPermissions({ shortlink: ['edit'] }, async () => {
		await getShlink().editShortUrl(data.shortCode, {
			longUrl: data.longUrl,
			title: data.title || null,
			tags: data.tags,
			crawlable: data.crawlable,
			forwardQuery: data.forwardQuery,
			maxVisits: data.maxVisits,
			validUntil: data.validUntil || null,
		});
	});
}

export async function deleteShortUrl(shortCode: string): Promise<void> {
	'use server';
	return withPermissions({ shortlink: ['delete'] }, async () => {
		await getShlink().deleteShortUrl(shortCode);
	});
}

export async function resetShortUrlVisits(shortCode: string): Promise<{ deletedCount: number }> {
	'use server';
	return withPermissions({ shortlink: ['edit'] }, async () => {
		const result = await getShlink().deleteShortUrlVisits(shortCode);
		return { deletedCount: result.deletedVisits };
	});
}
