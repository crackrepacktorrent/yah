import 'server-only';

import {
	isSettingsRecord,
	type ListmonkSettingsDocument,
} from './listmonk-settings-protocol';

const listmonkMaskPattern = /^\u2022+$/u;

export function isListmonkMaskedSecret(value: unknown): value is string {
	return typeof value === 'string' && (value === '' || listmonkMaskPattern.test(value));
}

export function maskedSecretPresent(value: unknown, label: string): boolean {
	if (value === undefined || value === '') return false;
	if (!isListmonkMaskedSecret(value)) {
		throw new Error(`Listmonk returned an unmasked ${label}.`);
	}
	return true;
}

function emptyMaskedProperty(record: Record<string, unknown>, key: string): void {
	const value = record[key];
	if (typeof value === 'string' && listmonkMaskPattern.test(value)) record[key] = '';
}

function emptyNestedMaskedProperty(
	document: ListmonkSettingsDocument,
	path: readonly string[],
): void {
	let record: Record<string, unknown> = document;
	for (const segment of path.slice(0, -1)) {
		const nested = record[segment];
		if (!isSettingsRecord(nested)) return;
		record = nested;
	}
	const key = path.at(-1);
	if (key) emptyMaskedProperty(record, key);
}

/** Only clears fields that Listmonk v6.2 masks and preserves on full PUT. */
export function prepareMaskedSettingsForWrite(
	input: ListmonkSettingsDocument,
): ListmonkSettingsDocument {
	const document = structuredClone(input);
	for (const collectionKey of ['smtp', 'bounce.mailboxes', 'messengers']) {
		const collection = document[collectionKey];
		if (!Array.isArray(collection)) continue;
		for (const item of collection) if (isSettingsRecord(item)) emptyMaskedProperty(item, 'password');
	}
	for (const path of [
		['upload.s3.aws_secret_access_key'],
		['bounce.sendgrid_key'],
		['bounce.azure', 'shared_secret'],
		['bounce.postmark', 'password'],
		['bounce.forwardemail', 'key'],
		['bounce.lettermint', 'key'],
		['security.captcha', 'hcaptcha', 'secret'],
		['security.oidc', 'client_secret'],
	] as const) emptyNestedMaskedProperty(document, path);
	return document;
}
