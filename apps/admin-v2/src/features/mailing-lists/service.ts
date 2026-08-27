import type { Permissions } from '@yah/admin-core/permissions';
import * as v from 'valibot';
import {
	CreateMailingListCommandSchema,
	MailingListCapabilitySchema,
	MailingListIdSchema,
	SetMailingListVisibilityCommandSchema,
	UpdateMailingListCommandSchema,
	isMailingListProviderFailure,
	type CreateMailingListCommand,
	type MailingList,
	type MailingListCapability,
	type SetMailingListVisibilityCommand,
	type UpdateMailingListCommand,
} from './contracts';
import { createPublicError } from '~/platform/errors';

export type MailingListManager = {
	list(): Promise<MailingList[]>;
	get(id: number): Promise<MailingList | null>;
	create(input: {
		name: string;
		kind: 'public' | 'private';
		optIn: 'single' | 'double';
		description: string;
	}): Promise<MailingList>;
	update(input: {
		id: number;
		name: string;
		kind: 'public' | 'private';
		optIn: 'single' | 'double';
		status: 'active' | 'archived';
		description: string;
		tags: string[];
	}): Promise<void>;
	delete(id: number): Promise<void>;
};

export type MailingListServiceDependencies = {
	enforcePermissions(headers: Headers, permissions: Permissions): Promise<void>;
	manager: MailingListManager;
};

function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
	schema: TSchema,
	input: unknown,
): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, input);
	if (!result.success) throw createPublicError(result.issues[0]?.message ?? 'Invalid mailing-list data.', 400);
	return result.output;
}

async function authorize(
	headers: Headers,
	capability: MailingListCapability,
	dependencies: MailingListServiceDependencies,
): Promise<void> {
	await dependencies.enforcePermissions(headers, { list: [capability] });
}

function notFound(): never {
	throw createPublicError('Mailing list not found.', 404);
}

function requireAuthorable(list: MailingList): asserts list is MailingList & { kind: 'public' | 'private' } {
	if (list.kind === 'temporary') {
		throw createPublicError('Temporary lists must be managed by Listmonk.', 409);
	}
}

function requireCurrentVersion(list: MailingList, expectedUpdatedAt: string): void {
	if (list.updatedAt !== expectedUpdatedAt) {
		throw createPublicError('This mailing list changed after you opened it. Refresh and try again.', 409);
	}
}

function requireActiveForSharing(list: MailingList): void {
	if (list.status === 'archived') {
		throw createPublicError('Reactivate this mailing list from its detail page before changing public sharing.', 409);
	}
}

function requireClearableDescription(list: MailingList, nextDescription: string): void {
	if (list.description !== '' && nextDescription === '') {
		throw createPublicError('Listmonk 6 cannot clear an existing list description. Replace it with new text or manage it in Listmonk.', 409);
	}
}

async function surfaceMutation(operation: () => Promise<void>): Promise<void> {
	try {
		await operation();
	} catch (error) {
		if (isMailingListProviderFailure(error) && [400, 409, 422].includes(error.status)) {
			throw createPublicError('Listmonk rejected the mailing-list change. Refresh and verify its settings.', 409);
		}
		throw error;
	}
}

export async function requireAuthorizedMailingListCapability(
	input: unknown,
	headers: Headers,
	dependencies: MailingListServiceDependencies,
): Promise<true> {
	const capability = parse(MailingListCapabilitySchema, input);
	await authorize(headers, capability, dependencies);
	return true;
}

export async function listAuthorizedMailingLists(
	headers: Headers,
	dependencies: MailingListServiceDependencies,
): Promise<MailingList[]> {
	await authorize(headers, 'view', dependencies);
	return dependencies.manager.list();
}

export async function readAuthorizedMailingList(
	input: unknown,
	headers: Headers,
	dependencies: MailingListServiceDependencies,
): Promise<MailingList> {
	const id = parse(MailingListIdSchema, input);
	await authorize(headers, 'view', dependencies);
	return (await dependencies.manager.get(id)) ?? notFound();
}

export async function createAuthorizedMailingList(
	input: CreateMailingListCommand,
	headers: Headers,
	dependencies: MailingListServiceDependencies,
): Promise<{ id: number }> {
	const command = parse(CreateMailingListCommandSchema, input);
	await authorize(headers, 'create', dependencies);
	try {
		return { id: (await dependencies.manager.create(command)).id };
	} catch (error) {
		if (isMailingListProviderFailure(error) && [400, 409, 422].includes(error.status)) {
			throw createPublicError('Listmonk rejected these mailing-list settings.', 400);
		}
		throw error;
	}
}

export async function updateAuthorizedMailingList(
	input: UpdateMailingListCommand,
	headers: Headers,
	dependencies: MailingListServiceDependencies,
): Promise<void> {
	const command = parse(UpdateMailingListCommandSchema, input);
	await authorize(headers, 'edit', dependencies);
	const current = (await dependencies.manager.get(command.id)) ?? notFound();
	requireAuthorable(current);
	requireCurrentVersion(current, command.expectedUpdatedAt);
	requireClearableDescription(current, command.description);
	await surfaceMutation(() => dependencies.manager.update({
		id: current.id,
		name: command.name,
		kind: command.kind,
		optIn: command.optIn,
		status: command.status,
		description: command.description,
		tags: current.tags,
	}));
}

export async function setAuthorizedMailingListVisibility(
	input: SetMailingListVisibilityCommand,
	headers: Headers,
	dependencies: MailingListServiceDependencies,
): Promise<void> {
	const command = parse(SetMailingListVisibilityCommandSchema, input);
	await authorize(headers, 'edit', dependencies);
	const current = (await dependencies.manager.get(command.id)) ?? notFound();
	requireAuthorable(current);
	requireCurrentVersion(current, command.expectedUpdatedAt);
	requireActiveForSharing(current);
	await surfaceMutation(() => dependencies.manager.update({
		id: current.id,
		name: current.name,
		kind: command.public ? 'public' : 'private',
		optIn: current.optIn,
		status: current.status,
		description: current.description,
		tags: current.tags,
	}));
}

export async function deleteAuthorizedMailingList(
	input: unknown,
	headers: Headers,
	dependencies: MailingListServiceDependencies,
): Promise<void> {
	const id = parse(MailingListIdSchema, input);
	await authorize(headers, 'delete', dependencies);
	const current = (await dependencies.manager.get(id)) ?? notFound();
	requireAuthorable(current);
	await surfaceMutation(() => dependencies.manager.delete(id));
}
