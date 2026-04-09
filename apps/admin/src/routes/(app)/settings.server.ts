import { query } from '@solidjs/router';
import { getListmonk, type ListmonkSettings } from '~/server/listmonk';
import { withPermissions } from '~/server/auth-helpers';

// ─── Queries ─────────────────────────────────────────────────────────────────

export const getEmailSettings = query(async () => {
	'use server';
	return withPermissions({ settings: ['view'] }, async () => {
		return getListmonk().getSettings();
	});
}, 'getEmailSettings');

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function updateEmailSettings(settings: Partial<ListmonkSettings>): Promise<void> {
	'use server';
	return withPermissions({ settings: ['edit'] }, async () => {
		// Listmonk requires the full settings object — fetch current state and merge
		const current = await getListmonk().getSettings();
		await getListmonk().updateSettings({ ...current, ...settings });
	});
}
