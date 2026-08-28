import type { AuthorizationContext } from '~/platform/auth/authorization-context';
import * as v from 'valibot';
import { isPrintedQrShortCode } from '@yah/admin-core/shortlink-policy';
import { createPublicError } from '~/platform/errors';
import { createPublicInputParser } from '~/platform/public-input';
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
	authorization: AuthorizationContext;
	manager: ShortlinkManager;
};

export type CreateShortlinkOutcome = { ok: true; shortCode: string } | { ok: false; reason: 'conflict' };
const parse = createPublicInputParser('Invalid shortlink data.');

async function authorize(
	capability: ShortlinkCapability,
	dependencies: ShortlinkServiceDependencies,
): Promise<void> {
	await dependencies.authorization.requirePermissions({ shortlink: [capability] });
}

export async function requireAuthorizedShortlinkCapability(
	input: unknown,
	dependencies: ShortlinkServiceDependencies,
): Promise<true> {
	const capability = parse(ShortlinkCapabilitySchema, input);
	await authorize(capability, dependencies);
	return true;
}

export async function listAuthorizedShortlinks(
	dependencies: ShortlinkServiceDependencies,
): Promise<Shortlink[]> {
	await authorize('view', dependencies);
	return dependencies.manager.list();
}

async function readAuthorizedShortlinkWithCapability(
	input: unknown,
	dependencies: ShortlinkServiceDependencies,
	capability: 'view' | 'edit',
): Promise<ShortlinkDetail> {
	const shortCode = parse(ShortCodeSchema, input);
	await authorize(capability, dependencies);
	const detail = await dependencies.manager.getDetail(shortCode);
	if (!detail) throw createPublicError('Shortlink not found.', 404);
	return detail;
}

export function readAuthorizedShortlink(
	input: unknown,
	dependencies: ShortlinkServiceDependencies,
): Promise<ShortlinkDetail> {
	return readAuthorizedShortlinkWithCapability(input, dependencies, 'view');
}

export async function readAuthorizedEditableShortlink(
	input: unknown,
	dependencies: ShortlinkServiceDependencies,
): Promise<EditableShortlink> {
	const shortCode = parse(ShortCodeSchema, input);
	await authorize('edit', dependencies);
	const shortlink = await dependencies.manager.getEditable(shortCode);
	if (!shortlink) throw createPublicError('Shortlink not found.', 404);
	return shortlink;
}

export async function createAuthorizedShortlink(
	input: CreateShortlinkCommand,
	dependencies: ShortlinkServiceDependencies,
): Promise<CreateShortlinkOutcome> {
	const command = parse(CreateShortlinkCommandSchema, input);
	await authorize('create', dependencies);
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
	dependencies: ShortlinkServiceDependencies,
): Promise<void> {
	const command = parse(EditShortlinkCommandSchema, input);
	await authorize('edit', dependencies);
	await dependencies.manager.edit(command);
}

export async function deleteAuthorizedShortlink(
	input: unknown,
	dependencies: ShortlinkServiceDependencies,
): Promise<void> {
	const shortCode = parse(ShortCodeSchema, input);
	await authorize('delete', dependencies);
	if (isPrintedQrShortCode(shortCode)) {
		throw createPublicError('This shortlink backs a printed QR code and cannot be deleted.', 409);
	}
	await dependencies.manager.delete(shortCode);
}

export async function resetAuthorizedShortlinkVisits(
	input: unknown,
	dependencies: ShortlinkServiceDependencies,
): Promise<{ deletedCount: number }> {
	const shortCode = parse(ShortCodeSchema, input);
	await authorize('edit', dependencies);
	return dependencies.manager.resetVisits(shortCode);
}

export async function readAuthorizedShortlinkOverview(
	dependencies: ShortlinkServiceDependencies,
): Promise<ShortlinkOverview> {
	await authorize('view', dependencies);
	return dependencies.manager.getOverview();
}
