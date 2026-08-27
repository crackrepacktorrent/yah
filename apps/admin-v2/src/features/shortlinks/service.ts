import type { Permissions } from '@yah/admin-core/permissions';
import * as v from 'valibot';
import {
	CreateShortlinkCommandSchema,
	EditShortlinkCommandSchema,
	ShortCodeSchema,
	ShortlinkCapabilitySchema,
	isShortlinkProviderFailure,
	type CreateShortlinkCommand,
	type EditableShortlink,
	type EditShortlinkCommand,
	type Shortlink,
	type ShortlinkCapability,
	type ShortlinkDetail,
	type ShortlinkOverview,
} from './contracts';
import { isPrintedQrShortCode } from '@yah/admin-core/shortlink-policy';
import { createPublicError } from '~/platform/errors';

export type ShortlinkManager = {
	list(): Promise<Shortlink[]>;
	getDetail(shortCode: string): Promise<ShortlinkDetail | null>;
	getEditable(shortCode: string): Promise<EditableShortlink | null>;
	create(input: v.InferOutput<typeof CreateShortlinkCommandSchema>): Promise<{ shortCode: string }>;
	edit(input: v.InferOutput<typeof EditShortlinkCommandSchema>): Promise<void>;
	delete(shortCode: string): Promise<void>;
	resetVisits(shortCode: string): Promise<{ deletedCount: number }>;
	getOverview(): Promise<ShortlinkOverview>;
};

export type ShortlinkServiceDependencies = {
	enforcePermissions(headers: Headers, permissions: Permissions): Promise<void>;
	manager: ShortlinkManager;
};

export type CreateShortlinkOutcome = { ok: true; shortCode: string } | { ok: false; reason: 'conflict' };

function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
	schema: TSchema,
	input: unknown,
): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, input);
	if (!result.success) throw createPublicError(result.issues[0]?.message ?? 'Invalid shortlink data.', 400);
	return result.output;
}

async function authorize(
	headers: Headers,
	capability: ShortlinkCapability,
	dependencies: ShortlinkServiceDependencies,
): Promise<void> {
	await dependencies.enforcePermissions(headers, { shortlink: [capability] });
}

export async function requireAuthorizedShortlinkCapability(
	input: unknown,
	headers: Headers,
	dependencies: ShortlinkServiceDependencies,
): Promise<true> {
	const capability = parse(ShortlinkCapabilitySchema, input);
	await authorize(headers, capability, dependencies);
	return true;
}

export async function listAuthorizedShortlinks(
	headers: Headers,
	dependencies: ShortlinkServiceDependencies,
): Promise<Shortlink[]> {
	await authorize(headers, 'view', dependencies);
	return dependencies.manager.list();
}

async function readAuthorizedShortlinkWithCapability(
	input: unknown,
	headers: Headers,
	dependencies: ShortlinkServiceDependencies,
	capability: 'view' | 'edit',
): Promise<ShortlinkDetail> {
	const shortCode = parse(ShortCodeSchema, input);
	await authorize(headers, capability, dependencies);
	const detail = await dependencies.manager.getDetail(shortCode);
	if (!detail) throw createPublicError('Shortlink not found.', 404);
	return detail;
}

export function readAuthorizedShortlink(
	input: unknown,
	headers: Headers,
	dependencies: ShortlinkServiceDependencies,
): Promise<ShortlinkDetail> {
	return readAuthorizedShortlinkWithCapability(input, headers, dependencies, 'view');
}

export async function readAuthorizedEditableShortlink(
	input: unknown,
	headers: Headers,
	dependencies: ShortlinkServiceDependencies,
): Promise<EditableShortlink> {
	const shortCode = parse(ShortCodeSchema, input);
	await authorize(headers, 'edit', dependencies);
	const shortlink = await dependencies.manager.getEditable(shortCode);
	if (!shortlink) throw createPublicError('Shortlink not found.', 404);
	return shortlink;
}

export async function createAuthorizedShortlink(
	input: CreateShortlinkCommand,
	headers: Headers,
	dependencies: ShortlinkServiceDependencies,
): Promise<CreateShortlinkOutcome> {
	const command = parse(CreateShortlinkCommandSchema, input);
	await authorize(headers, 'create', dependencies);
	try {
		return { ok: true, ...(await dependencies.manager.create(command)) };
	} catch (error) {
		if (
			isShortlinkProviderFailure(error) &&
			(error.status === 409 || error.problemType === 'non-unique-slug')
		) return { ok: false, reason: 'conflict' };
		throw error;
	}
}

export async function editAuthorizedShortlink(
	input: EditShortlinkCommand,
	headers: Headers,
	dependencies: ShortlinkServiceDependencies,
): Promise<void> {
	const command = parse(EditShortlinkCommandSchema, input);
	await authorize(headers, 'edit', dependencies);
	await dependencies.manager.edit(command);
}

export async function deleteAuthorizedShortlink(
	input: unknown,
	headers: Headers,
	dependencies: ShortlinkServiceDependencies,
): Promise<void> {
	const shortCode = parse(ShortCodeSchema, input);
	await authorize(headers, 'delete', dependencies);
	if (isPrintedQrShortCode(shortCode)) {
		throw createPublicError('This shortlink backs a printed QR code and cannot be deleted.', 409);
	}
	await dependencies.manager.delete(shortCode);
}

export async function resetAuthorizedShortlinkVisits(
	input: unknown,
	headers: Headers,
	dependencies: ShortlinkServiceDependencies,
): Promise<{ deletedCount: number }> {
	const shortCode = parse(ShortCodeSchema, input);
	await authorize(headers, 'edit', dependencies);
	return dependencies.manager.resetVisits(shortCode);
}

export async function readAuthorizedShortlinkOverview(
	headers: Headers,
	dependencies: ShortlinkServiceDependencies,
): Promise<ShortlinkOverview> {
	await authorize(headers, 'view', dependencies);
	return dependencies.manager.getOverview();
}
