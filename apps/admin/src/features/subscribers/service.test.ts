import { describe, expect, it, vi } from 'vitest';
import {
	SubscriberPartialMutationFailure,
	SubscriberAmbiguousOptInFailure,
	SubscriberProviderFailure,
	type CreateSubscriberCommand,
	type SubscriberDetail,
	type SubscriberMembership,
	type UpdateSubscriberProfileCommand,
} from './contracts';
import {
	blocklistAuthorizedSubscribers,
	createAuthorizedSubscriber,
	deleteAuthorizedSubscribers,
	listAuthorizedSubscribers,
	readAuthorizedSubscriber,
	readAuthorizedSubscriberActivity,
	readAuthorizedSubscriberMemberships,
	requestAuthorizedSubscriberOptIn,
	updateAuthorizedSubscriberMemberships,
	updateAuthorizedSubscriberProfile,
	type SubscriberServiceDependencies,
} from './service';

function membership(
	id: number,
	overrides: Partial<SubscriberMembership> = {},
): SubscriberMembership {
	return {
		id,
		uuid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
		name: `List ${id}`,
		kind: 'public',
		optIn: 'double',
		listStatus: 'active',
		description: `Description ${id}`,
		restricted: false,
		status: 'confirmed',
		createdAt: '2026-08-20T12:00:00Z',
		updatedAt: '2026-08-25T12:00:00Z',
		meta: {},
		...overrides,
	};
}

const subscriber: SubscriberDetail = {
	id: 7,
	uuid: '00000000-0000-4000-8000-000000000007',
	email: 'person@example.test',
	name: 'Example Person',
	status: 'enabled',
	createdAt: '2026-08-20T12:00:00Z',
	updatedAt: '2026-08-26T12:00:00Z',
	attributes: { city: 'Austin', nested: { source: 'provider' } },
	membershipVersion: `smv1-${'a'.repeat(43)}`,
	memberships: [
		membership(11),
		membership(12, { name: '*Unknown', description: null, restricted: true, status: 'unsubscribed' }),
	],
	canRequestOptIn: false,
};

const createCommand: CreateSubscriberCommand = {
	email: 'New.Person@Example.test',
	name: ' New Person ',
	status: 'enabled',
	listIds: [11],
	preconfirmSubscriptions: true,
};

const updateCommand: UpdateSubscriberProfileCommand = {
	id: subscriber.id,
	expectedUpdatedAt: subscriber.updatedAt,
	email: subscriber.email,
	name: subscriber.name,
	status: subscriber.status,
};

function dependencies(current: SubscriberDetail | null = subscriber): SubscriberServiceDependencies {
	return {
		authorization: { requirePermissions: vi.fn(async () => undefined), getCurrentUserId: vi.fn(async () => 'test-user') },
		manager: {
			list: vi.fn(async ({ page, search }) => ({ items: current ? [current] : [], total: current ? 1 : 0, page, pageSize: 50 as const, search })),
			get: vi.fn(async () => current),
			create: vi.fn(async (input) => ({
				...subscriber,
				id: 8,
				email: input.email,
				name: input.name,
				status: input.status,
			})),
			updateProfile: vi.fn(async (input) => ({ ...subscriber, ...input })),
			updateMemberships: vi.fn(async () => current ?? subscriber),
			delete: vi.fn(async () => undefined),
			blocklist: vi.fn(async () => undefined),
			activity: vi.fn(async () => ({ campaignViews: [], linkClicks: [] })),
			requestOptIn: vi.fn(async () => undefined),
		},
		mailingLists: {
			list: vi.fn(async () => [
				{ id: 11, kind: 'public' as const, optIn: 'double' as const, status: 'active' as const },
				{ id: 13, kind: 'private' as const, optIn: 'single' as const, status: 'archived' as const },
				{ id: 14, kind: 'temporary' as const, optIn: 'single' as const, status: 'active' as const },
				{ id: 15, kind: 'private' as const, optIn: 'single' as const, status: 'active' as const },
				{ id: 16, kind: 'private' as const, optIn: 'double' as const, status: 'active' as const },
			]),
		},
	};
}

describe('subscriber service boundary', () => {
	it('validates and normalizes fixed-page catalog input before one authorized provider call', async () => {
		const deps = dependencies();
		await expect(listAuthorizedSubscribers({ page: 2, search: '  person+tag  ' }, deps)).resolves.toMatchObject({
			page: 2,
			pageSize: 50,
			search: 'person+tag',
		});
		expect(deps.authorization.requirePermissions).toHaveBeenCalledWith({ subscriber: ['view'] });
		expect(deps.manager.list).toHaveBeenCalledWith({ page: 2, search: 'person+tag' });

		const invalid = dependencies();
		await expect(listAuthorizedSubscribers({ page: 0, search: '' }, invalid)).rejects.toThrow('valid subscriber page');
		expect(invalid.authorization.requirePermissions).not.toHaveBeenCalled();
		expect(invalid.manager.list).not.toHaveBeenCalled();
	});

	it('normalizes create input and validates every selected list before mutation', async () => {
		const deps = dependencies();
		await expect(createAuthorizedSubscriber(createCommand, deps)).resolves.toEqual({ id: 8 });
		expect(deps.authorization.requirePermissions).toHaveBeenNthCalledWith(1, { subscriber: ['create'] });
		expect(deps.authorization.requirePermissions).toHaveBeenNthCalledWith(2, { list: ['view'] });
		expect(deps.manager.create).toHaveBeenCalledWith({
			...createCommand,
			email: 'new.person@example.test',
			name: 'New Person',
		});

		for (const [listId, message] of [[99, 'no longer exist'], [13, 'only active'], [14, 'Temporary-list']] as const) {
			const rejected = dependencies();
			await expect(createAuthorizedSubscriber({ ...createCommand, listIds: [listId] }, rejected)).rejects.toThrow(message);
			expect(rejected.manager.create).not.toHaveBeenCalled();
		}

		const stranded = dependencies();
		await expect(createAuthorizedSubscriber({
			...createCommand,
			status: 'disabled',
			preconfirmSubscriptions: false,
		}, stranded)).rejects.toThrow('cannot start with unconfirmed double opt-in');
		expect(stranded.manager.create).not.toHaveBeenCalled();

		const explicitlyConfirmed = dependencies();
		await expect(createAuthorizedSubscriber({
			...createCommand,
			status: 'disabled',
			preconfirmSubscriptions: true,
		}, explicitlyConfirmed)).resolves.toEqual({ id: 8 });
	});

	it('returns a list-safe profile unless list viewing is separately authorized', async () => {
		const profile = dependencies();
		await expect(readAuthorizedSubscriber(7, profile)).resolves.toEqual({
			id: subscriber.id,
			uuid: subscriber.uuid,
			email: subscriber.email,
			name: subscriber.name,
			status: subscriber.status,
			createdAt: subscriber.createdAt,
			updatedAt: subscriber.updatedAt,
			attributes: subscriber.attributes,
		});
		expect(profile.authorization.requirePermissions).toHaveBeenCalledWith({ subscriber: ['view'] });

		const memberships = dependencies();
		await expect(readAuthorizedSubscriberMemberships(7, memberships)).resolves.toEqual({
			memberships: subscriber.memberships,
			membershipVersion: subscriber.membershipVersion,
			canRequestOptIn: false,
		});
		expect(memberships.authorization.requirePermissions).toHaveBeenCalledWith({
			subscriber: ['view'],
			list: ['view'],
		});

		const denied = dependencies();
		vi.mocked(denied.authorization.requirePermissions).mockRejectedValueOnce(new Error('denied'));
		await expect(readAuthorizedSubscriberMemberships(7, denied)).rejects.toThrow('denied');
		expect(denied.manager.get).not.toHaveBeenCalled();
	});

	it('splits profile and membership edits while preserving restricted, archived, temporary, and unsubscribed history', async () => {
		const withArchived = {
			...subscriber,
			memberships: [
				...subscriber.memberships,
				membership(13, { listStatus: 'archived' as const }),
				membership(14, { kind: 'temporary' as const }),
			],
		};
		const profile = dependencies(withArchived);
		await updateAuthorizedSubscriberProfile(updateCommand, profile);
		expect(profile.manager.updateProfile).toHaveBeenCalledWith(updateCommand);
		expect(profile.authorization.requirePermissions).toHaveBeenCalledTimes(1);
		expect(profile.mailingLists.list).not.toHaveBeenCalled();

		const memberships = dependencies(withArchived);
		await updateAuthorizedSubscriberMemberships({
			id: 7,
			expectedUpdatedAt: subscriber.updatedAt,
			expectedMembershipVersion: subscriber.membershipVersion,
			listIds: [15],
		}, memberships);
		expect(memberships.authorization.requirePermissions).toHaveBeenCalledWith({
			subscriber: ['edit'],
			list: ['view'],
		});
		expect(memberships.manager.updateMemberships).toHaveBeenCalledWith({
			id: 7,
			expectedUpdatedAt: subscriber.updatedAt,
			expectedMembershipVersion: subscriber.membershipVersion,
			listIds: [15, 12, 13, 14],
		});

		const stale = dependencies();
		await expect(updateAuthorizedSubscriberProfile({ ...updateCommand, expectedUpdatedAt: '2026-08-25T12:00:00Z' }, stale)).rejects.toThrow('changed after');
		expect(stale.manager.updateProfile).not.toHaveBeenCalled();
	});

	it('requires dedicated and explicit flows for blocklisting, restoration, and impossible name clearing', async () => {
		const accidentalBlocklist = dependencies();
		await expect(updateAuthorizedSubscriberProfile({ ...updateCommand, status: 'blocklisted' }, accidentalBlocklist)).rejects.toThrow('dedicated blocklist');

		const blocked = dependencies({ ...subscriber, status: 'blocklisted' });
		await expect(updateAuthorizedSubscriberProfile({ ...updateCommand, status: 'enabled' }, blocked)).rejects.toThrow('explicit recovery flow');

		const clear = dependencies();
		await expect(updateAuthorizedSubscriberProfile({ ...updateCommand, name: '' }, clear)).rejects.toThrow('cannot clear');
		expect(clear.manager.updateProfile).not.toHaveBeenCalled();
	});

	it('fails before PUT when Listmonk v6 could implicitly send or confirm opt-in mail', async () => {
		const pending = dependencies({
			...subscriber,
			memberships: [membership(11, { status: 'unconfirmed', optIn: 'double' })],
			canRequestOptIn: true,
		});
		await expect(updateAuthorizedSubscriberProfile(updateCommand, pending)).rejects.toThrow('cannot safely update');
		expect(pending.manager.updateProfile).not.toHaveBeenCalled();

		const newDouble = dependencies();
		await expect(updateAuthorizedSubscriberMemberships({
			id: 7,
			expectedUpdatedAt: subscriber.updatedAt,
			expectedMembershipVersion: subscriber.membershipVersion,
			listIds: [12, 16],
		}, newDouble)).resolves.toBeUndefined();
		expect(newDouble.manager.updateMemberships).toHaveBeenCalled();
	});

	it('rejects membership-only staleness before asking the manager to diff', async () => {
		const deps = dependencies();
		await expect(updateAuthorizedSubscriberMemberships({
			id: 7,
			expectedUpdatedAt: subscriber.updatedAt,
			expectedMembershipVersion: `smv1-${'b'.repeat(43)}`,
			listIds: [11, 12],
		}, deps)).rejects.toThrow('memberships changed');
		expect(deps.manager.updateMemberships).not.toHaveBeenCalled();
	});

	it('delegates bounded versioned delete and blocklist commands to the immediate adapter preflight', async () => {
		const deletion = dependencies();
		await deleteAuthorizedSubscribers({ subscribers: [{ id: 7, expectedUpdatedAt: subscriber.updatedAt }] }, deletion);
		expect(deletion.authorization.requirePermissions).toHaveBeenCalledWith({ subscriber: ['delete'] });
		expect(deletion.manager.delete).toHaveBeenCalledWith([{ id: 7, expectedUpdatedAt: subscriber.updatedAt }]);

		const blocklist = dependencies();
		await blocklistAuthorizedSubscribers({ subscribers: [{ id: 7, expectedUpdatedAt: subscriber.updatedAt }] }, blocklist);
		expect(blocklist.authorization.requirePermissions).toHaveBeenCalledWith({ subscriber: ['blocklist'] });
		expect(blocklist.manager.blocklist).toHaveBeenCalledWith([{ id: 7, expectedUpdatedAt: subscriber.updatedAt }]);

		const duplicate = dependencies();
		await expect(deleteAuthorizedSubscribers({ subscribers: [
			{ id: 7, expectedUpdatedAt: subscriber.updatedAt },
			{ id: 7, expectedUpdatedAt: subscriber.updatedAt },
		] }, duplicate)).rejects.toThrow('only once');
		expect(duplicate.authorization.requirePermissions).not.toHaveBeenCalled();

		const stale = dependencies();
		vi.mocked(stale.manager.blocklist).mockRejectedValueOnce(new SubscriberProviderFailure(409));
		await expect(blocklistAuthorizedSubscribers({ subscribers: [{ id: 7, expectedUpdatedAt: '2026-08-25T00:00:00Z' }] }, stale)).rejects.toThrow('changed after');
		expect(stale.manager.blocklist).toHaveBeenCalledTimes(1);
	});

	it('keeps activity on the actual activity contract and distinguishes a missing subscriber', async () => {
		const deps = dependencies();
		vi.mocked(deps.manager.activity).mockResolvedValueOnce({
			campaignViews: [{
				campaignId: 2,
				campaignUuid: '00000000-0000-4000-8000-000000000002',
				campaignName: 'Update',
				campaignSubject: 'News',
				viewCount: 3,
				lastViewedAt: '2026-08-26T12:00:00Z',
			}],
			linkClicks: [],
		});
		await expect(readAuthorizedSubscriberActivity(7, deps)).resolves.toMatchObject({
			campaignViews: [{ viewCount: 3 }],
		});
		expect(deps.authorization.requirePermissions).toHaveBeenCalledWith({
			subscriber: ['view'],
			campaign: ['view'],
		});

		const denied = dependencies();
		vi.mocked(denied.authorization.requirePermissions).mockRejectedValueOnce(new Error('denied'));
		await expect(readAuthorizedSubscriberActivity(7, denied)).rejects.toThrow('denied');
		expect(denied.manager.activity).not.toHaveBeenCalled();

		const missing = dependencies(null);
		vi.mocked(missing.manager.activity).mockResolvedValueOnce(null);
		await expect(readAuthorizedSubscriberActivity(99, missing)).rejects.toThrow('Subscriber not found');
	});

	it('requests opt-in only for a fresh enabled subscriber with an unconfirmed double-opt-in membership', async () => {
		const eligible = {
			...subscriber,
			memberships: [membership(11, { status: 'unconfirmed', optIn: 'double' })],
			canRequestOptIn: true,
		};
		const deps = dependencies(eligible);
		await requestAuthorizedSubscriberOptIn({
			id: 7,
			expectedUpdatedAt: eligible.updatedAt,
			expectedMembershipVersion: eligible.membershipVersion,
		}, deps);
		expect(deps.authorization.requirePermissions).toHaveBeenCalledWith({ subscriber: ['edit'], list: ['view'] });
		expect(deps.manager.requestOptIn).toHaveBeenCalledWith({
			id: 7,
			expectedUpdatedAt: eligible.updatedAt,
			expectedMembershipVersion: eligible.membershipVersion,
		});

		const ineligible = dependencies();
		await expect(requestAuthorizedSubscriberOptIn({
			id: 7,
			expectedUpdatedAt: subscriber.updatedAt,
			expectedMembershipVersion: subscriber.membershipVersion,
		}, ineligible)).rejects.toThrow('no unconfirmed double opt-in');
		expect(ineligible.manager.requestOptIn).not.toHaveBeenCalled();

		const ambiguous = dependencies(eligible);
		vi.mocked(ambiguous.manager.requestOptIn).mockRejectedValueOnce(new SubscriberAmbiguousOptInFailure());
		await expect(requestAuthorizedSubscriberOptIn({
			id: 7,
			expectedUpdatedAt: eligible.updatedAt,
			expectedMembershipVersion: eligible.membershipVersion,
		}, ambiguous)).rejects.toThrow('avoid duplicate email');
	});

	it('maps diagnostic-free expected provider conflicts at the service boundary', async () => {
		const create = dependencies();
		vi.mocked(create.manager.create).mockRejectedValueOnce(new SubscriberProviderFailure(409));
		await expect(createAuthorizedSubscriber(createCommand, create)).rejects.toThrow('already exists');

		const partialCreate = dependencies();
		vi.mocked(partialCreate.manager.create).mockRejectedValueOnce(new SubscriberPartialMutationFailure());
		await expect(createAuthorizedSubscriber(createCommand, partialCreate)).rejects.toThrow('Search for the email before retrying');

		const update = dependencies();
		vi.mocked(update.manager.updateProfile).mockRejectedValueOnce(new SubscriberProviderFailure(409));
		await expect(updateAuthorizedSubscriberProfile(updateCommand, update)).rejects.toThrow('changed after');
	});
});
