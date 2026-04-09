import { query } from '@solidjs/router';
import { getListmonk, type ListmonkSettings } from '~/server/listmonk';
import { withPermissions } from '~/server/auth-helpers';

const MASK_RE = /^\u2022+$/;

/** Replace any string that is purely bullet-dot characters (U+2022) with empty
 *  string so Listmonk's server-side password preservation logic kicks in. */
function stripMaskedValues<T>(obj: T): T {
	if (typeof obj === 'string') return (MASK_RE.test(obj) ? '' : obj) as T;
	if (Array.isArray(obj)) return obj.map(stripMaskedValues) as T;
	if (obj !== null && typeof obj === 'object') {
		return Object.fromEntries(
			Object.entries(obj).map(([k, v]) => [k, stripMaskedValues(v)]),
		) as T;
	}
	return obj;
}

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
		const client = getListmonk();

		// SMTP uses the full PUT /api/settings endpoint because Listmonk's
		// server-side handler preserves passwords by UUID when empty string is
		// sent (per-key PUT has no such logic and would wipe them).
		// All other keys use the per-key endpoint to avoid the fetch+merge bug.
		if ('smtp' in settings) {
			const current = await client.getSettings();
			const merged = { ...current, ...settings };
			// Listmonk's GET masks passwords as bullet dots (U+2022). The full
			// PUT preserves passwords only when they're empty string — dots would
			// be saved as the literal password. Strip them so preservation kicks in.
			await client.updateSettings(stripMaskedValues(merged));
		}

		const otherKeys = Object.entries(settings).filter(([key]) => key !== 'smtp');
		if (otherKeys.length > 0) {
			await Promise.all(
				otherKeys.map(([key, value]) => client.updateSettingsByKey(key, value)),
			);
		}
	});
}
