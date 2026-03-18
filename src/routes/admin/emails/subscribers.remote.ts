import { query, command } from '$app/server';
import * as v from 'valibot';
import { getListmonk } from '$lib/server/listmonk';
import { requireRole } from '$lib/server/auth-helpers';

export const listSubscribers = query(
	v.object({
		page: v.optional(v.number()),
		perPage: v.optional(v.number()),
		search: v.optional(v.string()),
	}),
	async ({ page, perPage, search }) => {
		await requireRole('owner', 'admin');

		// Listmonk expects a SQL WHERE clause for the query param.
		// Build a safe ILIKE expression from the user's search input.
		let query: string | undefined;
		if (search) {
			const escaped = search.replace(/'/g, "''").replace(/%/g, '\\%').replace(/_/g, '\\_');
			query = `(subscribers.email ILIKE '%${escaped}%' OR subscribers.name ILIKE '%${escaped}%')`;
		}

		const res = await getListmonk().listSubscribers({
			page: page ?? 1,
			per_page: perPage ?? 20,
			query,
		});
		return {
			subscribers: res.data.results,
			total: res.data.total,
			page: res.data.page,
			perPage: res.data.per_page,
		};
	},
);

export const getSubscriber = query(
	v.number(),
	async (id) => {
		await requireRole('owner', 'admin');
		return getListmonk().getSubscriber(id);
	},
);

export const createSubscriber = command(
	v.object({
		email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email')),
		name: v.optional(v.string()),
		status: v.optional(v.string()),
		listIds: v.optional(v.array(v.number())),
	}),
	async ({ email, name, status, listIds }) => {
		await requireRole('owner', 'admin');
		return getListmonk().createSubscriber({ email, name, status, lists: listIds });
	},
);

export const updateSubscriber = command(
	v.object({
		id: v.number(),
		email: v.optional(v.pipe(v.string(), v.nonEmpty(), v.email())),
		name: v.optional(v.string()),
		status: v.optional(v.string()),
		listIds: v.optional(v.array(v.number())),
	}),
	async ({ id, email, name, status, listIds }) => {
		await requireRole('owner', 'admin');
		return getListmonk().updateSubscriber(id, { email, name, status, lists: listIds });
	},
);

export const deleteSubscriber = command(
	v.number(),
	async (id) => {
		await requireRole('owner');
		await getListmonk().deleteSubscriber(id);
	},
);

export const blocklistSubscriber = command(
	v.number(),
	async (id) => {
		await requireRole('owner');
		await getListmonk().blocklistSubscriber(id);
	},
);
