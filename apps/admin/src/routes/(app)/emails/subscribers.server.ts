import { query } from '@solidjs/router';
import { getListmonk } from '~/server/listmonk';
import { withPermissions } from '~/server/auth-helpers';
import {
	CreateSubscriberInputSchema,
	SubscriberIdSchema,
	UpdateSubscriberInputSchema,
	type CreateSubscriberInput,
	type UpdateSubscriberInput,
} from '~/lib/admin-contracts';
import { idListSchema, parseInput } from '~/server/validation';

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listSubscribers = query(async () => {
	'use server';
	return withPermissions({ subscriber: ['view'] }, async () => {
		const res = await getListmonk().listSubscribers({ per_page: 'all' });
		return { subscribers: res.data.results, total: res.data.total };
	});
}, 'listSubscribers');

export const getSubscriberBounces = query(async (id: number) => {
	'use server';
	return withPermissions({ subscriber: ['view'] }, async () => {
		return getListmonk().getSubscriberBounces(parseInput(SubscriberIdSchema, id));
	});
}, 'getSubscriberBounces');

export const getSubscriberExport = query(async (id: number) => {
	'use server';
	return withPermissions({ subscriber: ['view'] }, async () => {
		return getListmonk().getSubscriberExport(parseInput(SubscriberIdSchema, id));
	});
}, 'getSubscriberExport');

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createSubscriber(params: CreateSubscriberInput) {
	'use server';
	return withPermissions({ subscriber: ['create'] }, async () => {
		const input = parseInput(CreateSubscriberInputSchema, params);
		return getListmonk().createSubscriber({
			email: input.email,
			name: input.name,
			status: input.status,
			lists: input.listIds,
			preconfirm: input.preconfirm,
		});
	});
}

export async function updateSubscriber(params: UpdateSubscriberInput) {
	'use server';
	return withPermissions({ subscriber: ['edit'] }, async () => {
		const { id, listIds, ...rest } = parseInput(UpdateSubscriberInputSchema, params);
		return getListmonk().updateSubscriber(id, { ...rest, lists: listIds });
	});
}

export async function deleteSubscribers(ids: number[]): Promise<void> {
	'use server';
	return withPermissions({ subscriber: ['delete'] }, async () => {
		await getListmonk().deleteSubscribers(parseInput(idListSchema, ids));
	});
}

export async function blocklistSubscribers(ids: number[]): Promise<void> {
	'use server';
	return withPermissions({ subscriber: ['blocklist'] }, async () => {
		await getListmonk().blocklistSubscribers(parseInput(idListSchema, ids));
	});
}

export async function deleteSubscriberBounces(id: number): Promise<void> {
	'use server';
	return withPermissions({ bounce: ['delete'] }, async () => {
		await getListmonk().deleteSubscriberBounces(parseInput(SubscriberIdSchema, id));
	});
}

export async function sendOptinConfirmation(subscriberId: number): Promise<void> {
	'use server';
	return withPermissions({ subscriber: ['edit'] }, async () => {
		await getListmonk().sendOptinConfirmation(parseInput(SubscriberIdSchema, subscriberId));
	});
}
