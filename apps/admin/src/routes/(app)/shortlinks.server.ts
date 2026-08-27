import { query } from '@solidjs/router';
import { getShlink, ShlinkApiError } from '~/server/shlink';
import { withPermissions, HttpError } from '~/server/auth-helpers';
import {
	CreateShortUrlInputSchema,
	EditShortUrlInputSchema,
	ShortCodeSchema,
	type CreateShortUrlInput,
	type EditShortUrlInput,
} from '~/lib/admin-contracts';
import { parseInput } from '~/server/validation';
import { isPrintedQrShortCode } from '@yah/admin-core/shortlink-policy';

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listShortUrls = query(async () => {
	'use server';
	return withPermissions({ shortlink: ['view'] }, async () => {
		const res = await getShlink().listShortUrls({
			itemsPerPage: 10000,
			orderBy: 'dateCreated-DESC',
		});
		return res.shortUrls.data;
	});
}, 'listShortUrls');

export const getShortUrl = query(async (shortCode: string) => {
	'use server';
	return withPermissions({ shortlink: ['view'] }, async () => {
		const validatedShortCode = parseInput(ShortCodeSchema, shortCode);
		try {
			return await getShlink().getShortUrl(validatedShortCode);
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
		const res = await getShlink().getShortUrlVisits(parseInput(ShortCodeSchema, shortCode), {
			itemsPerPage: 20,
			excludeBots: true,
		});
		return { visits: res.visits.data, pagination: res.visits.pagination };
	});
}, 'getShortUrlVisits');

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createShortUrl(data: CreateShortUrlInput): Promise<{ shortCode: string }> {
	'use server';
	return withPermissions({ shortlink: ['create'] }, async () => {
		const input = parseInput(CreateShortUrlInputSchema, data);
		const result = await getShlink().createShortUrl({
			longUrl: input.longUrl,
			customSlug: input.customSlug || undefined,
			title: input.title || undefined,
			tags: input.tags.length > 0 ? input.tags : undefined,
			crawlable: input.crawlable,
			forwardQuery: input.forwardQuery,
			maxVisits: input.maxVisits,
			validUntil: input.validUntil || undefined,
		});
		return { shortCode: result.shortCode };
	});
}

export async function editShortUrl(data: EditShortUrlInput): Promise<void> {
	'use server';
	return withPermissions({ shortlink: ['edit'] }, async () => {
		const input = parseInput(EditShortUrlInputSchema, data);
		await getShlink().editShortUrl(input.shortCode, {
			longUrl: input.longUrl,
			title: input.title || null,
			tags: input.tags,
			crawlable: input.crawlable,
			forwardQuery: input.forwardQuery,
			maxVisits: input.maxVisits,
			validUntil: input.validUntil || null,
		});
	});
}

export async function deleteShortUrl(shortCode: string): Promise<void> {
	'use server';
	return withPermissions({ shortlink: ['delete'] }, async () => {
		const validatedShortCode = parseInput(ShortCodeSchema, shortCode);
		if (isPrintedQrShortCode(validatedShortCode)) {
			throw new HttpError('This shortlink backs a printed QR code and cannot be deleted.', 409);
		}
		await getShlink().deleteShortUrl(validatedShortCode);
	});
}

export async function resetShortUrlVisits(shortCode: string): Promise<{ deletedCount: number }> {
	'use server';
	return withPermissions({ shortlink: ['edit'] }, async () => {
		const result = await getShlink().deleteShortUrlVisits(parseInput(ShortCodeSchema, shortCode));
		return { deletedCount: result.deletedVisits };
	});
}
