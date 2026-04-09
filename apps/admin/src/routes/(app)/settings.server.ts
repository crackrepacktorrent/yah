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

		// SMTP goes through the full PUT endpoint — it's the only one with
		// server-side password preservation (copies real password from DB when
		// incoming value is empty string, matched by UUID).
		if ('smtp' in settings) {
			const current = await client.getRawSettings();
			const merged = { ...current, ...settings };
			// Listmonk masks passwords as bullet dots (U+2022) in GET responses.
			// Strip to empty strings so the preservation logic kicks in.
			await client.updateSettings(stripMaskedValues(merged));
		}

		// Everything else uses per-key — no masking, no merge, no coupling.
		const otherKeys = Object.entries(settings).filter(([key]) => key !== 'smtp');
		if (otherKeys.length > 0) {
			await Promise.all(
				otherKeys.map(([key, value]) => client.updateSettingsByKey(key, value)),
			);
		}
	});
}
