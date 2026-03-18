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
		// Get unconfirmed subscribers for this list
		const res = await lm.listSubscribers({
			per_page: 'all',
			query: `subscribers.id IN (SELECT subscriber_id FROM subscriber_lists WHERE list_id = ${listId} AND status = 'unconfirmed')`,
		});
		const subscribers = res.data.results;
		if (subscribers.length === 0) {
			throw new Error('No unconfirmed subscribers on this list.');
		}
		// Send opt-in confirmation to each
		let sent = 0;
		for (const sub of subscribers) {
			try {
				await lm.sendOptinConfirmation(sub.id);
				sent++;
			} catch {
				// Some may fail (e.g. email config), continue with others
			}
		}
		return { sent, total: subscribers.length };
	},
);
