import { describe, expect, it, vi } from 'vitest';
import { MailingListProviderFailure, type MailingList } from './contracts';
import {
	createAuthorizedMailingList,
	deleteAuthorizedMailingList,
	listAuthorizedMailingLists,
	readAuthorizedMailingList,
	requireAuthorizedMailingListCapability,
	setAuthorizedMailingListVisibility,
	updateAuthorizedMailingList,
	type MailingListServiceDependencies,
} from './service';

const activePublic: MailingList = {
	id: 7,
	uuid: 'list-uuid-7',
	name: 'Housing updates',
	kind: 'public',
	optIn: 'double',
	status: 'active',
	description: 'Monthly updates',
	tags: ['housing'],
	subscriberCount: 12,
	unconfirmedCount: 2,
	createdAt: '2026-08-20T12:00:00Z',
	updatedAt: '2026-08-26T12:00:00Z',
};

function dependencies(list: MailingList | null = activePublic): MailingListServiceDependencies {
	return {
		enforcePermissions: vi.fn(async () => undefined),
		manager: {
			list: vi.fn(async () => (list ? [list] : [])),
			get: vi.fn(async () => list),
			create: vi.fn(async (input) => ({ ...activePublic, ...input })),
			update: vi.fn(async () => undefined),
			delete: vi.fn(async () => undefined),
		},
	};
}

describe('mailing-list service boundary', () => {
	it('enforces each exact capability before its provider operation', async () => {
		const deps = dependencies();
		await listAuthorizedMailingLists(new Headers(), deps);
		await readAuthorizedMailingList(7, new Headers(), deps);
		await createAuthorizedMailingList(
			{ name: 'Private launch', kind: 'private', optIn: 'double', description: '' },
			new Headers(),
			deps,
		);
		await updateAuthorizedMailingList(
			{
				id: 7,
				expectedUpdatedAt: activePublic.updatedAt,
				name: activePublic.name,
				kind: 'public',
				optIn: activePublic.optIn,
				status: activePublic.status,
				description: activePublic.description,
			},
			new Headers(),
			deps,
		);
		await setAuthorizedMailingListVisibility(
			{ id: 7, expectedUpdatedAt: activePublic.updatedAt, public: false },
			new Headers(),
			deps,
		);
		await deleteAuthorizedMailingList(7, new Headers(), deps);

		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(1, expect.any(Headers), { list: ['view'] });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(2, expect.any(Headers), { list: ['view'] });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(3, expect.any(Headers), { list: ['create'] });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(4, expect.any(Headers), { list: ['edit'] });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(5, expect.any(Headers), { list: ['edit'] });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(6, expect.any(Headers), { list: ['delete'] });
	});

	it('validates commands before authorization or provider access', async () => {
		const deps = dependencies();
		await expect(
			createAuthorizedMailingList(
				{ name: '', kind: 'public', optIn: 'double', description: '' },
				new Headers(),
				deps,
			),
		).rejects.toThrow('Enter a list name.');
		await expect(requireAuthorizedMailingListCapability('admin', new Headers(), deps)).rejects.toThrow();
		expect(deps.enforcePermissions).not.toHaveBeenCalled();
		expect(deps.manager.create).not.toHaveBeenCalled();
	});

	it('preserves provider-owned fields in a full update', async () => {
		const deps = dependencies();
		await updateAuthorizedMailingList(
			{
				id: 7,
				expectedUpdatedAt: activePublic.updatedAt,
				name: 'Renamed',
				kind: 'private',
				optIn: 'single',
				status: 'archived',
				description: 'Replacement',
			},
			new Headers(),
			deps,
		);

		expect(deps.manager.update).toHaveBeenCalledWith({
			id: 7,
			name: 'Renamed',
			kind: 'private',
			optIn: 'single',
			status: 'archived',
			description: 'Replacement',
			tags: ['housing'],
		});
	});

	it('rejects stale edits and impossible description clearing before PUT', async () => {
		const stale = dependencies();
		await expect(
			updateAuthorizedMailingList(
				{
					id: 7,
					expectedUpdatedAt: '2026-08-25T12:00:00Z',
					name: activePublic.name,
					kind: 'public',
					optIn: 'double',
					status: 'active',
					description: activePublic.description,
				},
				new Headers(),
				stale,
			),
		).rejects.toThrow('changed after you opened it');
		expect(stale.manager.update).not.toHaveBeenCalled();

		const clearing = dependencies();
		await expect(
			updateAuthorizedMailingList(
				{
					id: 7,
					expectedUpdatedAt: activePublic.updatedAt,
					name: activePublic.name,
					kind: 'public',
					optIn: 'double',
					status: 'active',
					description: '',
				},
				new Headers(),
				clearing,
			),
		).rejects.toThrow('cannot clear an existing list description');
		expect(clearing.manager.update).not.toHaveBeenCalled();
	});

	it('publishes and unpublishes active lists from the current provider projection', async () => {
		const privateList = { ...activePublic, kind: 'private' as const };
		const publish = dependencies(privateList);
		await setAuthorizedMailingListVisibility(
			{ id: 7, expectedUpdatedAt: privateList.updatedAt, public: true },
			new Headers(),
			publish,
		);
		expect(publish.manager.update).toHaveBeenCalledWith({
			id: 7,
			name: privateList.name,
			kind: 'public',
			optIn: privateList.optIn,
			status: 'active',
			description: privateList.description,
			tags: privateList.tags,
		});

		const unpublish = dependencies();
		await setAuthorizedMailingListVisibility(
			{ id: 7, expectedUpdatedAt: activePublic.updatedAt, public: false },
			new Headers(),
			unpublish,
		);
		expect(unpublish.manager.update).toHaveBeenCalledWith(expect.objectContaining({ kind: 'private', status: 'active' }));
	});

	it('requires archived lists to be reactivated explicitly before sharing changes', async () => {
		const archived = dependencies({ ...activePublic, status: 'archived' });
		await expect(
			setAuthorizedMailingListVisibility(
				{ id: 7, expectedUpdatedAt: activePublic.updatedAt, public: false },
				new Headers(),
				archived,
			),
		).rejects.toThrow('Reactivate this mailing list');
		expect(archived.manager.update).not.toHaveBeenCalled();
	});

	it('keeps temporary provider lists read-only', async () => {
		const temporary = dependencies({ ...activePublic, kind: 'temporary' });
		await expect(
			setAuthorizedMailingListVisibility(
				{ id: 7, expectedUpdatedAt: activePublic.updatedAt, public: true },
				new Headers(),
				temporary,
			),
		).rejects.toThrow('Temporary lists must be managed by Listmonk.');
		await expect(deleteAuthorizedMailingList(7, new Headers(), temporary)).rejects.toThrow('Temporary lists');
		expect(temporary.manager.update).not.toHaveBeenCalled();
		expect(temporary.manager.delete).not.toHaveBeenCalled();
	});

	it('normalizes missing records and expected provider rejections', async () => {
		await expect(readAuthorizedMailingList(77, new Headers(), dependencies(null))).rejects.toThrow('Mailing list not found.');

		const rejected = dependencies();
		vi.mocked(rejected.manager.delete).mockRejectedValueOnce(new MailingListProviderFailure(409));
		await expect(deleteAuthorizedMailingList(7, new Headers(), rejected)).rejects.toThrow(
			'Listmonk rejected the mailing-list change.',
		);
	});
});
