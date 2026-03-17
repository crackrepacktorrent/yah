import { query, command } from '$app/server';
import * as v from 'valibot';
import { getListmonk } from '$lib/server/listmonk';
import { requireRole } from '$lib/server/auth-helpers';

export const listLists = query(async () => {
	await requireRole('owner', 'admin');
	return { lists: await getListmonk().listLists() };
});

export const createList = command(
	v.object({
		name: v.pipe(v.string(), v.nonEmpty('Name is required')),
		type: v.picklist(['public', 'private']),
		optin: v.picklist(['single', 'double']),
		description: v.optional(v.string()),
	}),
	async (params) => {
		await requireRole('owner', 'admin');
		return getListmonk().createList(params);
	},
);

export const updateList = command(
	v.object({
		id: v.number(),
		name: v.optional(v.pipe(v.string(), v.nonEmpty())),
		type: v.optional(v.picklist(['public', 'private'])),
		optin: v.optional(v.picklist(['single', 'double'])),
		description: v.optional(v.string()),
	}),
	async ({ id, ...params }) => {
		await requireRole('owner', 'admin');
		return getListmonk().updateList(id, params);
	},
);

export const deleteList = command(
	v.number(),
	async (id) => {
		await requireRole('owner');
		await getListmonk().deleteList(id);
	},
);
