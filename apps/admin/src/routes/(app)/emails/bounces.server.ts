import { query } from '@solidjs/router';
import { getListmonk } from '~/server/listmonk';
import { withPermissions } from '~/server/auth-helpers';
import { idListSchema, parseInput } from '~/server/validation';

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listBounces = query(async () => {
	'use server';
	return withPermissions({ bounce: ['view'] }, async () => {
		const res = await getListmonk().listBounces({ per_page: 'all' });
		return { bounces: res.data.results, total: res.data.total };
	});
}, 'listBounces');

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function deleteBounces(ids: number[]): Promise<void> {
	'use server';
	return withPermissions({ bounce: ['delete'] }, async () => {
		await getListmonk().deleteBounces(parseInput(idListSchema, ids));
	});
}

export async function deleteAllBounces(): Promise<void> {
	'use server';
	return withPermissions({ bounce: ['clear-all'] }, async () => {
		await getListmonk().deleteAllBounces();
	});
}
