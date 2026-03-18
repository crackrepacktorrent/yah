import * as v from 'valibot';
import { getListmonk } from '$lib/server/listmonk';
import { protectedQuery, protectedCommand } from '$lib/server/auth-helpers';

export const listSubscribers = protectedQuery(
	{ subscriber: ['view'] },
	async () => {
		const res = await getListmonk().listSubscribers({
			per_page: 'all',
		});
		return {
			subscribers: res.data.results,
			total: res.data.total,
		};
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

export const sendOptinConfirmation = protectedCommand(
	{ subscriber: ['edit'] },
	v.number(),
	async (subscriberId) => {
		await getListmonk().sendOptinConfirmation(subscriberId);
	},
);
