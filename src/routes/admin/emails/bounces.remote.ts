import { query, command } from '$app/server';
import * as v from 'valibot';
import { getListmonk } from '$lib/server/listmonk';
import { requireRole } from '$lib/server/auth-helpers';

export const listBounces = query(
	v.object({
		page: v.optional(v.number()),
		perPage: v.optional(v.number()),
	}),
	async ({ page, perPage }) => {
		await requireRole('owner', 'admin');
		const res = await getListmonk().listBounces({
			page: page ?? 1,
			per_page: perPage ?? 20,
		});
		return {
			bounces: res.data.results,
			total: res.data.total,
			page: res.data.page,
			perPage: res.data.per_page,
		};
	},
);

export const deleteBounce = command(
	v.number(),
	async (id) => {
		await requireRole('owner');
		await getListmonk().deleteBounce(id);
	},
);

export const deleteAllBounces = command(async () => {
	await requireRole('owner');
	await getListmonk().deleteAllBounces();
});
