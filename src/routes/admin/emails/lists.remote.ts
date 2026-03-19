import * as v from 'valibot';
import { getListmonk } from '$lib/server/listmonk';
import { protectedQuery, protectedCommand } from '$lib/server/auth-helpers';

export const listLists = protectedQuery({ list: ['view'] }, async () => {
	return { lists: await getListmonk().listLists() };
});

export const createList = protectedCommand(
	{ list: ['create'] },
	v.object({
		name: v.pipe(v.string(), v.nonEmpty('Name is required')),
		type: v.picklist(['public', 'private']),
		optin: v.picklist(['single', 'double']),
		description: v.optional(v.string()),
	}),
	async (params) => {
		return getListmonk().createList(params);
	},
);

export const updateList = protectedCommand(
	{ list: ['edit'] },
	v.object({
		id: v.number(),
		name: v.optional(v.pipe(v.string(), v.nonEmpty())),
		type: v.optional(v.picklist(['public', 'private'])),
		optin: v.optional(v.picklist(['single', 'double'])),
		description: v.optional(v.string()),
	}),
	async ({ id, ...params }) => {
		return getListmonk().updateList(id, params);
	},
);

export const deleteList = protectedCommand(
	{ list: ['delete'] },
	v.number(),
	async (id) => {
		await getListmonk().deleteList(id);
	},
);

export const sendOptinCampaign = protectedCommand(
	{ list: ['edit'] },
	v.number(),
	async (listId) => {
		const lm = getListmonk();
		// Fetch all subscribers and filter to those with unconfirmed status on this list.
		// Avoids raw SQL injection — Listmonk's query param accepts raw SQL which is unsafe.
		const res = await lm.listSubscribers({ per_page: 'all' });
		const unconfirmed = res.data.results.filter((sub) =>
			sub.lists.some((l) => l.id === listId && l.subscription_status === 'unconfirmed'),
		);
		if (unconfirmed.length === 0) {
			throw new Error('No unconfirmed subscribers on this list.');
		}
		const results = await Promise.allSettled(
			unconfirmed.map((sub) => lm.sendOptinConfirmation(sub.id)),
		);
		const sent = results.filter((r) => r.status === 'fulfilled').length;
		return { sent, total: unconfirmed.length };
	},
);
