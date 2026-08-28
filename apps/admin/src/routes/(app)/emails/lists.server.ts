import { query } from '@solidjs/router';
import { getListmonk, type ListmonkList } from '~/server/listmonk';
import { HttpError, withPermissions } from '~/server/auth-helpers';
import {
	CreateListInputSchema,
	ListIdSchema,
	UpdateListInputSchema,
	type CreateListInput,
	type UpdateListInput,
} from '~/lib/admin-contracts';
import { idListSchema, parseInput } from '~/server/validation';

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listLists = query(async (): Promise<{ lists: ListmonkList[] }> => {
	'use server';
	return withPermissions({ list: ['view'] }, async () => {
		const lists = await getListmonk().listLists();
		return { lists };
	});
}, 'listLists');

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createList(params: CreateListInput) {
	'use server';
	return withPermissions({ list: ['create'] }, async () => {
		return getListmonk().createList(parseInput(CreateListInputSchema, params));
	});
}

export async function updateList(params: UpdateListInput) {
	'use server';
	return withPermissions({ list: ['edit'] }, async () => {
		const { id, ...rest } = parseInput(UpdateListInputSchema, params);
		return getListmonk().updateList(id, rest);
	});
}

export async function deleteLists(ids: number[]): Promise<void> {
	'use server';
	return withPermissions({ list: ['delete'] }, async () => {
		await getListmonk().deleteLists(parseInput(idListSchema, ids));
	});
}

export async function sendOptinCampaign(listId: number): Promise<{ sent: number; total: number }> {
	'use server';
	return withPermissions({ list: ['edit'] }, async () => {
		const validatedListId = parseInput(ListIdSchema, listId);
		const lm = getListmonk();
		const res = await lm.listSubscribers({ per_page: 'all' });
		const unconfirmed = res.data.results.filter((sub) =>
			sub.lists.some(
				(l: { id: number; subscription_status: string }) => l.id === validatedListId && l.subscription_status === 'unconfirmed',
			),
		);
		if (unconfirmed.length === 0) {
			throw new HttpError('No unconfirmed subscribers on this list.', 409);
		}
		const results = await Promise.allSettled(unconfirmed.map((sub: { id: number }) => lm.sendOptinConfirmation(sub.id)));
		const sent = results.filter((r) => r.status === 'fulfilled').length;
		return { sent, total: unconfirmed.length };
	});
}
