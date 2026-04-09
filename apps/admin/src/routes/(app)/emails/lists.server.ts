import { query } from '@solidjs/router';
import { getListmonk, type ListmonkList } from '~/server/listmonk';
import { withPermissions } from '~/server/auth-helpers';

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listLists = query(async (): Promise<{ lists: ListmonkList[] }> => {
	'use server';
	return withPermissions({ list: ['view'] }, async () => {
		const lists = await getListmonk().listLists();
		return { lists };
	});
}, 'listLists');

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createList(params: {
	name: string;
	type: 'public' | 'private';
	optin: 'single' | 'double';
	description?: string;
}) {
	'use server';
	return withPermissions({ list: ['create'] }, async () => {
		return getListmonk().createList(params);
	});
}

export async function updateList(params: {
	id: number;
	name?: string;
	type?: 'public' | 'private';
	optin?: 'single' | 'double';
	description?: string;
}) {
	'use server';
	return withPermissions({ list: ['edit'] }, async () => {
		const { id, ...rest } = params;
		return getListmonk().updateList(id, rest);
	});
}

export async function deleteLists(ids: number[]): Promise<void> {
	'use server';
	return withPermissions({ list: ['delete'] }, async () => {
		await getListmonk().deleteLists(ids);
	});
}

export async function sendOptinCampaign(listId: number): Promise<{ sent: number; total: number }> {
	'use server';
	return withPermissions({ list: ['edit'] }, async () => {
		const lm = getListmonk();
		const res = await lm.listSubscribers({ per_page: 'all' });
		const unconfirmed = res.data.results.filter((sub) =>
			sub.lists.some((l: { id: number; subscription_status: string }) =>
				l.id === listId && l.subscription_status === 'unconfirmed',
			),
		);
		if (unconfirmed.length === 0) {
			throw new Error('No unconfirmed subscribers on this list.');
		}
		const results = await Promise.allSettled(
			unconfirmed.map((sub: { id: number }) => lm.sendOptinConfirmation(sub.id)),
		);
		const sent = results.filter((r) => r.status === 'fulfilled').length;
		return { sent, total: unconfirmed.length };
	});
}
