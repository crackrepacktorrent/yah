import * as v from 'valibot';
import { getListmonk } from '$lib/server/listmonk';
import { protectedQuery, protectedCommand } from '$lib/server/auth-helpers';

export const listSubscribers = protectedQuery(
	{ subscriber: ['view'] },
	v.object({
		page: v.optional(v.number()),
		perPage: v.optional(v.number()),
		search: v.optional(v.string()),
	}),
	async ({ page, perPage, search }) => {
		// Listmonk's subscriber query API expects a raw SQL WHERE clause.
		// We manually escape special characters since parameterized queries aren't supported.
		let query: string | undefined;
		if (search) {
			const escaped = search.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/%/g, '\\%').replace(/_/g, '\\_');
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

export const getSubscriber = protectedQuery(
	{ subscriber: ['view'] },
	v.number(),
	async (id) => {
		return getListmonk().getSubscriber(id);
	},
);

export const createSubscriber = protectedCommand(
	{ subscriber: ['create'] },
	v.object({
		email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email')),
		name: v.optional(v.string()),
		status: v.optional(v.string()),
		listIds: v.optional(v.array(v.number())),
	}),
	async ({ email, name, status, listIds }) => {
		return getListmonk().createSubscriber({ email, name, status, lists: listIds });
	},
);

export const updateSubscriber = protectedCommand(
	{ subscriber: ['edit'] },
	v.object({
		id: v.number(),
		email: v.optional(v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email'))),
		name: v.optional(v.string()),
		status: v.optional(v.string()),
		listIds: v.optional(v.array(v.number())),
	}),
	async ({ id, email, name, status, listIds }) => {
		return getListmonk().updateSubscriber(id, { email, name, status, lists: listIds });
	},
);

export const deleteSubscriber = protectedCommand(
	{ subscriber: ['delete'] },
	v.number(),
	async (id) => {
		await getListmonk().deleteSubscriber(id);
	},
);

export const blocklistSubscriber = protectedCommand(
	{ subscriber: ['blocklist'] },
	v.number(),
	async (id) => {
		await getListmonk().blocklistSubscriber(id);
	},
);
