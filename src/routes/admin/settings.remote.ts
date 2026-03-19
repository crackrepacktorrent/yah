import * as v from 'valibot';
import { env } from '$env/dynamic/private';
import { getListmonk } from '$lib/server/listmonk';
import { protectedQuery, protectedCommand } from '$lib/server/auth-helpers';

export const getServiceUrls = protectedQuery({ settings: ['view'] }, async () => {
	return {
		listmonk: env.LISTMONK_URL ?? null,
		umami: env.UMAMI_URL ?? null,
	};
});

export const getEmailSettings = protectedQuery({ settings: ['view'] }, async () => {
	return getListmonk().getSettings();
});

export const updateEmailSettings = protectedCommand(
	{ settings: ['edit'] },
	v.record(v.string(), v.unknown()),
	async (settings) => {
		await getListmonk().updateSettings(settings);
	},
);
