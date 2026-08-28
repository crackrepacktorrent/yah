import type { AuthorizationContext } from '~/platform/auth/authorization-context';
import { createPublicError } from '~/platform/errors';
import { createPublicInputParser } from '~/platform/public-input';
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
	authorization: AuthorizationContext;
	manager: MailingListManager;
};
const parse = createPublicInputParser('Invalid mailing-list data.');

async function authorize(
	capability: MailingListCapability,
	dependencies: MailingListServiceDependencies,
): Promise<void> {
	await dependencies.authorization.requirePermissions({ list: [capability] });
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
	dependencies: MailingListServiceDependencies,
): Promise<true> {
	const capability = parse(MailingListCapabilitySchema, input);
	await authorize(capability, dependencies);
	return true;
}

export async function listAuthorizedMailingLists(
	dependencies: MailingListServiceDependencies,
): Promise<MailingList[]> {
	await authorize('view', dependencies);
	return dependencies.manager.list();
}

export async function readAuthorizedMailingList(
	input: unknown,
	dependencies: MailingListServiceDependencies,
): Promise<MailingList> {
	const id = parse(MailingListIdSchema, input);
	await authorize('view', dependencies);
	return (await dependencies.manager.get(id)) ?? notFound();
}

export async function createAuthorizedMailingList(
	input: CreateMailingListCommand,
	dependencies: MailingListServiceDependencies,
): Promise<{ id: number }> {
	const command = parse(CreateMailingListCommandSchema, input);
	await authorize('create', dependencies);
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
	dependencies: MailingListServiceDependencies,
): Promise<void> {
	const command = parse(UpdateMailingListCommandSchema, input);
	await authorize('edit', dependencies);
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
	dependencies: MailingListServiceDependencies,
): Promise<void> {
	const command = parse(SetMailingListVisibilityCommandSchema, input);
	await authorize('edit', dependencies);
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
	dependencies: MailingListServiceDependencies,
): Promise<void> {
	const id = parse(MailingListIdSchema, input);
	await authorize('delete', dependencies);
	const current = (await dependencies.manager.get(id)) ?? notFound();
	requireAuthorable(current);
	await surfaceMutation(() => dependencies.manager.delete(id));
}
