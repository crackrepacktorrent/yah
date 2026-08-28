import { query } from '@solidjs/router';
import { getListmonk, type ListmonkSettings, type ListmonkSmtpConfig } from '~/server/listmonk';
import { HttpError, withPermissions } from '~/server/auth-helpers';
import { EmailSettingsPatchSchema, TestSmtpInputSchema, type EmailSettingsPatch, type TestSmtpInput } from '~/lib/admin-contracts';
import { parseInput } from '~/server/validation';

const MASK_RE = /^\u2022+$/;

/** Replace masked bullet-dot strings (U+2022) with empty strings.
 *  Listmonk's full PUT endpoint preserves all password fields (SMTP,
 *  bounce boxes, messengers, postmark) when it receives an empty string,
 *  matched by UUID. */
function stripMaskedValues<T>(obj: T): T {
	if (typeof obj === 'string') return (MASK_RE.test(obj) ? '' : obj) as T;
	if (Array.isArray(obj)) return obj.map(stripMaskedValues) as T;
	if (obj !== null && typeof obj === 'object') {
		return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, stripMaskedValues(v)])) as T;
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

export async function updateEmailSettings(settings: EmailSettingsPatch): Promise<void> {
	'use server';
	return withPermissions({ settings: ['edit'] }, async () => {
		const client = getListmonk();
		const validatedSettings = parseInput(EmailSettingsPatchSchema, settings) as Partial<ListmonkSettings>;

		// Single full PUT: avoids per-key calls racing with Listmonk's
		// ~500ms post-write restart. Masked passwords (U+2022) are stripped
		// to empty strings — Listmonk preserves all password fields (SMTP,
		// bounce boxes, messengers, postmark) via UUID matching when empty.
		const current = await client.getRawSettings();
		const merged = { ...current, ...validatedSettings };
		await client.updateSettings(stripMaskedValues(merged));
	});
}

export const getEmailLogs = query(async () => {
	'use server';
	return withPermissions({ settings: ['view'] }, async () => {
		return getListmonk().getLogs();
	});
}, 'getEmailLogs');

export async function testSmtpConnection(config: TestSmtpInput): Promise<string[]> {
	'use server';
	return withPermissions({ settings: ['edit'] }, async () => {
		const input = parseInput(TestSmtpInputSchema, config) as ListmonkSmtpConfig & { email: string };
		if (input.auth_protocol !== 'none' && !input.password) {
			throw new HttpError('Enter the SMTP password to test the connection.', 400);
		}
		return getListmonk().testSmtp(input);
	});
}
