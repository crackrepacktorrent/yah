import * as v from 'valibot';
import { getListmonk } from '$lib/server/listmonk';
import { protectedQuery, protectedCommand } from '$lib/server/auth-helpers';

export const listBounces = protectedQuery(
	{ bounce: ['view'] },
	v.object({
		page: v.optional(v.number()),
		perPage: v.optional(v.number()),
	}),
	async ({ page, perPage }) => {
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

export const deleteBounce = protectedCommand(
	{ bounce: ['delete'] },
	v.number(),
	async (id) => {
		await getListmonk().deleteBounce(id);
	},
);

export const deleteAllBounces = protectedCommand({ bounce: ['clear-all'] }, async () => {
	await getListmonk().deleteAllBounces();
});
