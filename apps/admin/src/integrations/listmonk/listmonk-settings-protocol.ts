import 'server-only';

import * as v from 'valibot';
import { providerContractError, providerInvariantError } from '~/integrations/provider-contract.server';

export type ListmonkSettingsDocument = Record<string, unknown>;

export function parseListmonkValue<
	TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
>(schema: TSchema, input: unknown, label: string): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, input);
	if (!result.success) throw providerContractError('Listmonk', `${label} response`, result.issues);
	return result.output;
}

export function isSettingsRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function settingsRecord(
	document: ListmonkSettingsDocument,
	key: string,
): Record<string, unknown> {
	const value = document[key];
	if (!isSettingsRecord(value)) throw providerContractError('Listmonk', `${key} setting (expected an object)`);
	return value;
}

export function settingsCollection(
	document: ListmonkSettingsDocument,
	key: string,
): Record<string, unknown>[] {
	const value = document[key];
	if (!Array.isArray(value) || value.some((item) => !isSettingsRecord(item))) {
		throw providerContractError('Listmonk', `${key} setting (expected an array of objects)`);
	}
	return value;
}

export function assertStableSettingsIdentifiers(
	document: ListmonkSettingsDocument,
	collections: readonly string[] = ['smtp', 'bounce.mailboxes', 'messengers'],
): void {
	for (const collectionKey of collections) {
		const collection = document[collectionKey];
		if (!Array.isArray(collection)) continue;
		const identifiers = collection.map((item) => isSettingsRecord(item) ? item['uuid'] : undefined);
		if (identifiers.some((identifier) => typeof identifier !== 'string' || identifier.length === 0)) {
			throw providerInvariantError(`Listmonk ${collectionKey} entries need stable identifiers. Re-enter their credentials and save them once in the private Listmonk operator UI before using YAH settings.`);
		}
		if (new Set(identifiers).size !== identifiers.length) {
			throw providerInvariantError(`Listmonk returned duplicate ${collectionKey} identifiers.`);
		}
	}
}

export function settingsRecordsByUuid(
	document: ListmonkSettingsDocument,
	key: string,
): Map<string, Record<string, unknown>> {
	const collection = settingsCollection(document, key);
	assertStableSettingsIdentifiers(document, [key]);
	return new Map(collection.map((item) => [item['uuid'] as string, item]));
}
