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

		// For SMTP, preserve unchanged passwords ourselves since the per-key
		// endpoint does a raw overwrite. The frontend sends empty string for
		// unchanged passwords — we copy the real password from the DB by UUID.
		if ('smtp' in settings && Array.isArray(settings.smtp)) {
			const current = await client.getSettings();
			settings.smtp = settings.smtp.map((s) => {
				if (s.password === '') {
					const existing = current.smtp?.find((c) => c.uuid === s.uuid);
					if (existing) s = { ...s, password: existing.password };
				}
				return s;
			});
		}

		await Promise.all(
			Object.entries(settings).map(([key, value]) =>
				client.updateSettingsByKey(key, stripMaskedValues(value)),
			),
		);
	});
}
