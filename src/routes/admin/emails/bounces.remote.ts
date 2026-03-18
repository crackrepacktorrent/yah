import * as v from 'valibot';
import { getListmonk } from '$lib/server/listmonk';
import { protectedQuery, protectedCommand } from '$lib/server/auth-helpers';

export const listBounces = protectedQuery(
	{ bounce: ['view'] },
	async () => {
		const res = await getListmonk().listBounces({
			per_page: 'all',
		});
		return {
			bounces: res.data.results,
			total: res.data.total,
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
