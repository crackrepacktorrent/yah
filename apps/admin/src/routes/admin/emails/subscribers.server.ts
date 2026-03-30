import { query } from '@solidjs/router';
import { getListmonk } from '~/server/listmonk';
import { withPermissions } from '~/server/auth-helpers';

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
		return getListmonk().getSubscriberBounces(id);
	});
}, 'getSubscriberBounces');

export const getSubscriberExport = query(async (id: number) => {
	'use server';
	return withPermissions({ subscriber: ['view'] }, async () => {
		return getListmonk().getSubscriberExport(id);
	});
}, 'getSubscriberExport');

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createSubscriber(params: {
	email: string;
	name?: string;
	status?: string;
	listIds?: number[];
	preconfirm?: boolean;
}) {
	'use server';
	return withPermissions({ subscriber: ['create'] }, async () => {
		return getListmonk().createSubscriber({
			email: params.email,
			name: params.name,
			status: params.status,
			lists: params.listIds,
			preconfirm: params.preconfirm,
		});
	});
}

export async function updateSubscriber(params: {
	id: number;
	email?: string;
	name?: string;
	status?: string;
	listIds?: number[];
	preconfirm?: boolean;
}) {
	'use server';
	return withPermissions({ subscriber: ['edit'] }, async () => {
		const { id, listIds, ...rest } = params;
		return getListmonk().updateSubscriber(id, { ...rest, lists: listIds });
	});
}

export async function deleteSubscribers(ids: number[]): Promise<void> {
	'use server';
	return withPermissions({ subscriber: ['delete'] }, async () => {
		await getListmonk().deleteSubscribers(ids);
	});
}

export async function blocklistSubscribers(ids: number[]): Promise<void> {
	'use server';
	return withPermissions({ subscriber: ['blocklist'] }, async () => {
		await getListmonk().blocklistSubscribers(ids);
	});
}

export async function deleteSubscriberBounces(id: number): Promise<void> {
	'use server';
	return withPermissions({ bounce: ['delete'] }, async () => {
		await getListmonk().deleteSubscriberBounces(id);
	});
}

export async function sendOptinConfirmation(subscriberId: number): Promise<void> {
	'use server';
	return withPermissions({ subscriber: ['edit'] }, async () => {
		await getListmonk().sendOptinConfirmation(subscriberId);
	});
}
