import 'server-only';
import type { AuthorizationContext } from '~/platform/auth/authorization-context';
import { createPublicError } from '~/platform/errors';
import { createPublicInputParser } from '~/platform/public-input';
import {
	BlocklistSubscribersCommandSchema,
	CreateSubscriberCommandSchema,
	DeleteSubscribersCommandSchema,
	ListSubscribersQuerySchema,
	MAX_SUBSCRIBER_MEMBERSHIPS,
	RequestSubscriberOptInCommandSchema,
	SubscriberCapabilitySchema,
	SubscriberIdSchema,
	UpdateSubscriberMembershipsCommandSchema,
	UpdateSubscriberProfileCommandSchema,
	isSubscriberAmbiguousOptInFailure,
	isSubscriberPartialMutationFailure,
	isSubscriberProviderFailure,
	type AuthorableSubscriberStatus,
	type BlocklistSubscribersCommand,
	type CreateSubscriberCommand,
	type DeleteSubscribersCommand,
	type ListSubscribersQuery,
	type RequestSubscriberOptInCommand,
	type SubscriberActivity,
	type SubscriberCapability,
	type SubscriberDetail,
	type SubscriberMembershipState,
	type SubscriberPage,
	type SubscriberProfile,
	type SubscriberStatus,
	type SubscriberVersion,
	type UpdateSubscriberMembershipsCommand,
	type UpdateSubscriberProfileCommand,
} from './contracts';

export type SubscriberManager = {
	list(input: { page: number; search: string }): Promise<SubscriberPage>;
	get(id: number): Promise<SubscriberDetail | null>;
	create(input: {
		email: string;
		name: string;
		status: AuthorableSubscriberStatus;
		listIds: number[];
		preconfirmSubscriptions: boolean;
	}): Promise<SubscriberDetail>;
	updateProfile(input: {
		id: number;
		expectedUpdatedAt: string;
		email: string;
		name: string;
		status: SubscriberStatus;
	}): Promise<SubscriberDetail>;
	updateMemberships(input: {
		id: number;
		expectedUpdatedAt: string;
		expectedMembershipVersion: string;
		listIds: number[];
	}): Promise<SubscriberDetail>;
	delete(subscribers: readonly SubscriberVersion[]): Promise<void>;
	blocklist(subscribers: readonly SubscriberVersion[]): Promise<void>;
	activity(id: number): Promise<SubscriberActivity | null>;
	requestOptIn(subscriber: SubscriberVersion & { expectedMembershipVersion: string }): Promise<void>;
};

type SubscriberMailingListCatalog = {
	list(): Promise<Array<{
		id: number;
		kind: 'public' | 'private' | 'temporary';
		optIn: 'single' | 'double';
		status: 'active' | 'archived';
	}>>;
};

export type SubscriberServiceDependencies = {
	authorization: AuthorizationContext;
	manager: SubscriberManager;
	mailingLists: SubscriberMailingListCatalog;
};
const parse = createPublicInputParser('Invalid subscriber data.');

function notFound(): never {
	throw createPublicError('Subscriber not found.', 404);
}

async function authorize(
	capability: SubscriberCapability,
	dependencies: SubscriberServiceDependencies,
): Promise<void> {
	await dependencies.authorization.requirePermissions({ subscriber: [capability] });
}

function requireCurrentVersion(subscriber: SubscriberDetail, expectedUpdatedAt: string): void {
	if (subscriber.updatedAt !== expectedUpdatedAt) {
		throw createPublicError('This subscriber changed after you opened it. Refresh and try again.', 409);
	}
}

function requireCurrentMembershipVersion(subscriber: SubscriberDetail, expectedMembershipVersion: string): void {
	if (subscriber.membershipVersion !== expectedMembershipVersion) {
		throw createPublicError('This subscriber’s memberships changed after you opened them. Refresh and try again.', 409);
	}
}

function requireEditableStatus(current: SubscriberDetail, next: SubscriberStatus): void {
	if (current.status !== 'blocklisted' && next === 'blocklisted') {
		throw createPublicError('Use the dedicated blocklist action to blocklist a subscriber.', 409);
	}
	if (current.status === 'blocklisted' && next !== 'blocklisted') {
		throw createPublicError(
			'Restoring a blocklisted subscriber requires an explicit recovery flow because their list subscriptions remain unsubscribed.',
			409,
		);
	}
}

function requireClearableName(current: SubscriberDetail, nextName: string): void {
	if (current.name !== '' && nextName === '') {
		throw createPublicError('Listmonk 6 cannot clear an existing subscriber name. Enter a replacement name.', 409);
	}
}

function requireSafeFullUpdate(current: SubscriberDetail, completeListIds: readonly number[]): void {
	const retainedPendingDoubleOptIn = current.memberships.some((membership) =>
		completeListIds.includes(membership.id) &&
		membership.status === 'unconfirmed' &&
		membership.optIn === 'double'
	);
	if (retainedPendingDoubleOptIn) {
		throw createPublicError(
			'Listmonk 6 cannot safely update this subscriber while a retained double opt-in membership is unconfirmed; it may send an implicit confirmation request.',
			409,
		);
	}
}

async function requireValidMembershipTargets(
	listIds: number[],
	currentMembershipIds: ReadonlySet<number>,
	dependencies: SubscriberServiceDependencies,
): Promise<Array<{ id: number; kind: 'public' | 'private' | 'temporary'; optIn: 'single' | 'double'; status: 'active' | 'archived' }>> {
	const additions = listIds.filter((id) => !currentMembershipIds.has(id));
	if (additions.length === 0) return [];
	const catalog = new Map((await dependencies.mailingLists.list()).map((list) => [list.id, list]));
	const targets = [];
	for (const id of additions) {
		const list = catalog.get(id);
		if (!list) {
			throw createPublicError('One or more selected mailing lists no longer exist. Refresh and try again.', 409);
		}
		if (list.status !== 'active') {
			throw createPublicError('New subscriber memberships can use only active mailing lists.', 409);
		}
		if (list.kind === 'temporary') {
			throw createPublicError('Temporary-list memberships must be managed by Listmonk.', 409);
		}
		targets.push({ id: list.id, kind: list.kind, optIn: list.optIn, status: list.status });
	}
	return targets;
}

function surfaceMutationFailure(error: unknown, operation: 'create' | 'change'): never {
	if (isSubscriberAmbiguousOptInFailure(error)) {
		throw createPublicError(
			'Listmonk may have accepted this confirmation request. Wait and refresh before trying again to avoid duplicate email.',
			409,
		);
	}
	if (isSubscriberPartialMutationFailure(error)) {
		if (operation === 'create') {
			throw createPublicError(
				'Listmonk may have created this subscriber identity without every membership. Search for the email before retrying.',
				409,
			);
		}
		throw createPublicError(
			'Listmonk may have partially applied this membership change. Refresh the subscriber before trying again.',
			409,
		);
	}
	if (isSubscriberProviderFailure(error) && error.status === 404) notFound();
	if (isSubscriberProviderFailure(error) && error.status === 409) {
		if (operation === 'create') throw createPublicError('A subscriber with this email already exists.', 409);
		throw createPublicError('This subscriber changed after you opened it. Refresh and try again.', 409);
	}
	if (isSubscriberProviderFailure(error) && [400, 422].includes(error.status)) {
		if (operation === 'create') throw createPublicError('Listmonk rejected these subscriber settings.', 400);
		throw createPublicError('Listmonk rejected the subscriber change. Refresh and verify its details.', 409);
	}
	throw error;
}

export async function requireAuthorizedSubscriberCapability(
	input: unknown,
	dependencies: SubscriberServiceDependencies,
): Promise<true> {
	const capability = parse(SubscriberCapabilitySchema, input);
	await authorize(capability, dependencies);
	return true;
}

export async function listAuthorizedSubscribers(
	input: ListSubscribersQuery,
	dependencies: SubscriberServiceDependencies,
): Promise<SubscriberPage> {
	const query = parse(ListSubscribersQuerySchema, input);
	await authorize('view', dependencies);
	return dependencies.manager.list(query);
}

export async function readAuthorizedSubscriber(
	input: unknown,
	dependencies: SubscriberServiceDependencies,
): Promise<SubscriberProfile> {
	const id = parse(SubscriberIdSchema, input);
	await authorize('view', dependencies);
	const { memberships: _memberships, membershipVersion: _membershipVersion, canRequestOptIn: _canRequestOptIn, ...profile } =
		(await dependencies.manager.get(id)) ?? notFound();
	return profile;
}

export async function readAuthorizedSubscriberMemberships(
	input: unknown,
	dependencies: SubscriberServiceDependencies,
): Promise<SubscriberMembershipState> {
	const id = parse(SubscriberIdSchema, input);
	await dependencies.authorization.requirePermissions({ subscriber: ['view'], list: ['view'] });
	const { memberships, membershipVersion, canRequestOptIn } = (await dependencies.manager.get(id)) ?? notFound();
	return { memberships, membershipVersion, canRequestOptIn };
}

export async function createAuthorizedSubscriber(
	input: CreateSubscriberCommand,
	dependencies: SubscriberServiceDependencies,
): Promise<{ id: number }> {
	const command = parse(CreateSubscriberCommandSchema, input);
	await authorize('create', dependencies);
	if (command.listIds.length > 0) {
		await dependencies.authorization.requirePermissions({ list: ['view'] });
		const targets = await requireValidMembershipTargets(command.listIds, new Set(), dependencies);
		if (
			command.status === 'disabled' &&
			!command.preconfirmSubscriptions &&
			targets.some(({ optIn }) => optIn === 'double')
		) {
			throw createPublicError(
				'Disabled subscribers cannot start with unconfirmed double opt-in memberships. Confirm them immediately or create an enabled subscriber.',
				400,
			);
		}
	}
	try {
		return { id: (await dependencies.manager.create(command)).id };
	} catch (error) {
		surfaceMutationFailure(error, 'create');
	}
}

export async function updateAuthorizedSubscriberProfile(
	input: UpdateSubscriberProfileCommand,
	dependencies: SubscriberServiceDependencies,
): Promise<void> {
	const command = parse(UpdateSubscriberProfileCommandSchema, input);
	await authorize('edit', dependencies);
	const current = (await dependencies.manager.get(command.id)) ?? notFound();
	requireCurrentVersion(current, command.expectedUpdatedAt);
	requireEditableStatus(current, command.status);
	requireClearableName(current, command.name);
	const completeListIds = current.memberships.map(({ id }) => id);
	requireSafeFullUpdate(current, completeListIds);

	try {
		await dependencies.manager.updateProfile(command);
	} catch (error) {
		surfaceMutationFailure(error, 'change');
	}
}

export async function updateAuthorizedSubscriberMemberships(
	input: UpdateSubscriberMembershipsCommand,
	dependencies: SubscriberServiceDependencies,
): Promise<void> {
	const command = parse(UpdateSubscriberMembershipsCommandSchema, input);
	await dependencies.authorization.requirePermissions({ subscriber: ['edit'], list: ['view'] });
	const current = (await dependencies.manager.get(command.id)) ?? notFound();
	requireCurrentVersion(current, command.expectedUpdatedAt);
	requireCurrentMembershipVersion(current, command.expectedMembershipVersion);
	if (current.status === 'blocklisted') {
		throw createPublicError('Blocklisted subscribers cannot receive new memberships.', 409);
	}
	const protectedIds = current.memberships
		.filter((membership) =>
			membership.restricted ||
			membership.kind === 'temporary' ||
			membership.listStatus === 'archived' ||
			membership.status === 'unsubscribed'
		)
		.map(({ id }) => id);
	const completeListIds = [...new Set([...command.listIds, ...protectedIds])];
	if (completeListIds.length > MAX_SUBSCRIBER_MEMBERSHIPS) {
		throw createPublicError(
			`This subscriber exceeds the ${MAX_SUBSCRIBER_MEMBERSHIPS}-membership safety limit after preserving protected memberships.`,
			409,
		);
	}
	await requireValidMembershipTargets(
		completeListIds,
		new Set(current.memberships.map(({ id }) => id)),
		dependencies,
	);

	try {
		await dependencies.manager.updateMemberships({
			id: current.id,
			expectedUpdatedAt: current.updatedAt,
			expectedMembershipVersion: current.membershipVersion,
			listIds: completeListIds,
		});
	} catch (error) {
		surfaceMutationFailure(error, 'change');
	}
}

export async function deleteAuthorizedSubscribers(
	input: DeleteSubscribersCommand,
	dependencies: SubscriberServiceDependencies,
): Promise<void> {
	const command = parse(DeleteSubscribersCommandSchema, input);
	await authorize('delete', dependencies);
	try {
		await dependencies.manager.delete(command.subscribers);
	} catch (error) {
		surfaceMutationFailure(error, 'change');
	}
}

export async function blocklistAuthorizedSubscribers(
	input: BlocklistSubscribersCommand,
	dependencies: SubscriberServiceDependencies,
): Promise<void> {
	const command = parse(BlocklistSubscribersCommandSchema, input);
	await authorize('blocklist', dependencies);
	try {
		await dependencies.manager.blocklist(command.subscribers);
	} catch (error) {
		surfaceMutationFailure(error, 'change');
	}
}

export async function readAuthorizedSubscriberActivity(
	input: unknown,
	dependencies: SubscriberServiceDependencies,
): Promise<SubscriberActivity> {
	const id = parse(SubscriberIdSchema, input);
	await dependencies.authorization.requirePermissions({ subscriber: ['view'], campaign: ['view'] });
	return (await dependencies.manager.activity(id)) ?? notFound();
}

export async function requestAuthorizedSubscriberOptIn(
	input: RequestSubscriberOptInCommand,
	dependencies: SubscriberServiceDependencies,
): Promise<void> {
	const command = parse(RequestSubscriberOptInCommandSchema, input);
	await dependencies.authorization.requirePermissions({ subscriber: ['edit'], list: ['view'] });
	const current = (await dependencies.manager.get(command.id)) ?? notFound();
	requireCurrentVersion(current, command.expectedUpdatedAt);
	requireCurrentMembershipVersion(current, command.expectedMembershipVersion);
	if (!current.canRequestOptIn) {
		throw createPublicError(
			'This subscriber has no unconfirmed double opt-in membership eligible for a confirmation request.',
			409,
		);
	}
	try {
		await dependencies.manager.requestOptIn({
			id: current.id,
			expectedUpdatedAt: current.updatedAt,
			expectedMembershipVersion: current.membershipVersion,
		});
	} catch (error) {
		surfaceMutationFailure(error, 'change');
	}
}
