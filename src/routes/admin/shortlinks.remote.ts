import * as v from 'valibot';
import { getShlink, ShlinkApiError } from '$lib/server/shlink';
import { error, invalid, redirect } from '@sveltejs/kit';
import { protectedQuery, protectedCommand, protectedForm } from '$lib/server/auth-helpers';

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getDashboard = protectedQuery({ shortlink: ['view'] }, async () => {
	const shlink = getShlink();

	const [shortUrlsRes, overallVisitsRes] = await Promise.all([
		shlink.listShortUrls({ itemsPerPage: 5, orderBy: 'dateCreated-DESC' }),
		shlink.getOverallVisits(),
	]);

	return {
		recentShortUrls: shortUrlsRes.shortUrls.data,
		totalShortUrls: shortUrlsRes.shortUrls.pagination.totalItems,
		visits: overallVisitsRes.visits,
	};
});

export const listShortUrls = protectedQuery({ shortlink: ['view'] }, async () => {
	const shlink = getShlink();

	const res = await shlink.listShortUrls({
		itemsPerPage: 10000,
		orderBy: 'dateCreated-DESC',
	});

	return { shortUrls: res.shortUrls.data };
});

export const getShortUrl = protectedQuery(
	{ shortlink: ['view'] },
	v.string(),
	async (shortCode) => {
		const shlink = getShlink();

		try {
			return await shlink.getShortUrl(shortCode);
		} catch (err) {
			if (err instanceof ShlinkApiError && err.status === 404) {
				error(404, 'Shortlink not found');
			}
			throw err;
		}
	},
);

export const getShortUrlVisits = protectedQuery(
	{ shortlink: ['view'] },
	v.string(),
	async (shortCode) => {
		const shlink = getShlink();
		const res = await shlink.getShortUrlVisits(shortCode, { itemsPerPage: 20, excludeBots: true });
		return {
			visits: res.visits.data,
			pagination: res.visits.pagination,
		};
	},
);

// ─── Forms ────────────────────────────────────────────────────────────────────

export const createShortUrl = protectedCommand(
	{ shortlink: ['create'] },
	v.object({
		longUrl: v.pipe(v.string(), v.nonEmpty('Destination URL is required'), v.url()),
		customSlug: v.optional(v.string(), ''),
		title: v.optional(v.string(), ''),
		tags: v.optional(v.string(), ''),
		maxVisits: v.optional(v.pipe(v.string(), v.transform((s) => s.trim())), ''),
		validUntil: v.optional(v.string(), ''),
		crawlable: v.optional(v.boolean(), false),
		forwardQuery: v.optional(v.boolean(), true),
	}),
	async (data) => {
		const tags = data.tags
			.split(',')
			.map((t: string) => t.trim())
			.filter(Boolean);

		const shlink = getShlink();
		const result = await shlink.createShortUrl({
			longUrl: data.longUrl,
			customSlug: data.customSlug || undefined,
			title: data.title || undefined,
			tags: tags.length > 0 ? tags : undefined,
			crawlable: data.crawlable,
			forwardQuery: data.forwardQuery,
			maxVisits: data.maxVisits ? (parseInt(data.maxVisits, 10) || undefined) : undefined,
			validUntil: data.validUntil || undefined,
		});
		return { shortCode: result.shortCode };
	},
);

export const editShortUrl = protectedForm(
	{ shortlink: ['edit'] },
	v.object({
		shortCode: v.string(),
		longUrl: v.optional(v.string(), ''),
		title: v.optional(v.string(), ''),
		tags: v.optional(v.string(), ''),
		maxVisits: v.optional(v.pipe(v.string(), v.transform((s) => s.trim())), ''),
		validUntil: v.optional(v.string(), ''),
		crawlable: v.optional(v.boolean(), false),
		forwardQuery: v.optional(v.boolean(), false),
	}),
	async (data, issue) => {
		const tags = data.tags
			.split(',')
			.map((t: string) => t.trim())
			.filter(Boolean);

		try {
			const shlink = getShlink();
			await shlink.editShortUrl(data.shortCode, {
				longUrl: data.longUrl || undefined,
				title: data.title || null,
				tags,
				crawlable: data.crawlable,
				forwardQuery: data.forwardQuery,
				maxVisits: data.maxVisits ? (parseInt(data.maxVisits, 10) || null) : null,
				validUntil: data.validUntil || null,
			});
			return { success: true };
		} catch (err) {
			if (err instanceof ShlinkApiError) {
				invalid(issue.longUrl(err.detail));
			}
			throw err;
		}
	},
);

export const deleteShortUrl = protectedCommand(
	{ shortlink: ['delete'] },
	v.string(),
	async (shortCode) => {
		const shlink = getShlink();
		await shlink.deleteShortUrl(shortCode);
	},
);

export const resetShortUrlVisits = protectedCommand(
	{ shortlink: ['edit'] },
	v.string(),
	async (shortCode) => {
		const shlink = getShlink();
		const result = await shlink.deleteShortUrlVisits(shortCode);
		return { deletedCount: result.deletedVisits };
	},
);
