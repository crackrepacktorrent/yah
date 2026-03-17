import { query, form, command } from '$app/server';
import * as v from 'valibot';
import { getShlink, ShlinkApiError } from '$lib/server/shlink';
import { error, invalid, redirect } from '@sveltejs/kit';
import { requireRole } from '$lib/server/auth-helpers';

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getDashboard = query(async () => {
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

export const listShortUrls = query(
	v.object({
		page: v.optional(v.number(), 1),
		search: v.optional(v.string(), ''),
		orderBy: v.optional(v.string(), 'dateCreated-DESC'),
	}),
	async ({ page, search, orderBy }) => {
		const shlink = getShlink();

		const res = await shlink.listShortUrls({
			page,
			itemsPerPage: 20,
			searchTerm: search || undefined,
			orderBy,
		});

		return {
			shortUrls: res.shortUrls.data,
			pagination: res.shortUrls.pagination,
		};
	},
);

export const getShortUrl = query(
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

export const getShortUrlVisits = query(
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

export const createShortUrl = command(
	v.object({
		longUrl: v.pipe(v.string(), v.nonEmpty('Destination URL is required'), v.url()),
		customSlug: v.optional(v.string(), ''),
		title: v.optional(v.string(), ''),
		tags: v.optional(v.string(), ''),
		maxVisits: v.optional(v.string(), ''),
		validUntil: v.optional(v.string(), ''),
		crawlable: v.optional(v.boolean(), false),
		forwardQuery: v.optional(v.boolean(), true),
	}),
	async (data) => {
		await requireRole('admin', 'owner');

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
			maxVisits: data.maxVisits ? Number(data.maxVisits) : undefined,
			validUntil: data.validUntil || undefined,
		});
		return { shortCode: result.shortCode };
	},
);

export const editShortUrl = form(
	v.object({
		shortCode: v.string(),
		longUrl: v.optional(v.string(), ''),
		title: v.optional(v.string(), ''),
		tags: v.optional(v.string(), ''),
		maxVisits: v.optional(v.string(), ''),
		validUntil: v.optional(v.string(), ''),
		crawlable: v.optional(v.boolean(), false),
		forwardQuery: v.optional(v.boolean(), false),
	}),
	async (data, issue) => {
		await requireRole('admin', 'owner');

		const tags = data.tags
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);

		try {
			const shlink = getShlink();
			await shlink.editShortUrl(data.shortCode, {
				longUrl: data.longUrl || undefined,
				title: data.title || null,
				tags,
				crawlable: data.crawlable,
				forwardQuery: data.forwardQuery,
				maxVisits: data.maxVisits ? Number(data.maxVisits) : null,
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

export const deleteShortUrl = command(
	v.string(),
	async (shortCode) => {
		await requireRole('admin', 'owner');
		const shlink = getShlink();
		await shlink.deleteShortUrl(shortCode);
	},
);

export const resetShortUrlVisits = command(
	v.string(),
	async (shortCode) => {
		await requireRole('admin', 'owner');
		const shlink = getShlink();
		const result = await shlink.deleteShortUrlVisits(shortCode);
		return { deletedCount: result.deletedVisits };
	},
);
