import type { Permissions } from '@yah/admin-core/permissions';
import { describe, expect, it, vi } from 'vitest';
import {
	cancelAuthorizedInvitation,
	inviteAuthorizedMember,
	listAuthorizedMembers,
	listAuthorizedPendingInvitations,
	readAuthorizedMemberForRoleEdit,
	removeAuthorizedMember,
	requireAuthorizedMembershipRouteCapability,
	updateAuthorizedMemberRoles,
	type DirectoryInvitation,
	type DirectoryMember,
	type MembershipDirectory,
} from './service';

const selfMember: DirectoryMember = {
	id: 'membership-self',
	userId: 'user-self',
	role: 'admin, member,admin',
	user: { name: ' Current Admin ', email: ' admin@example.test ' },
};
const otherMember: DirectoryMember = {
	id: 'membership-other',
	userId: 'user-other',
	role: 'member',
	user: { name: null, email: 'other@example.test' },
};
const pendingInvitation: DirectoryInvitation = {
	id: 'invitation-pending',
	email: ' invited@example.test ',
	role: 'member, admin,member',
	status: 'pending',
	expiresAt: new Date('2026-09-30T17:00:00.000Z'),
};

function setup() {
	const enforcePermissions = vi.fn(async (_headers: Headers, _permissions: Permissions) => undefined);
	const getCurrentUserId = vi.fn(async (_headers: Headers) => 'user-self');
	const directory: MembershipDirectory = {
		listMembers: vi.fn(async () => [selfMember, otherMember]),
		getMember: vi.fn(async (memberId) =>
			[selfMember, otherMember].find((member) => member.id === memberId) ?? null),
		listInvitations: vi.fn(async () => [
			pendingInvitation,
			{
				id: 'invitation-accepted',
				email: 'accepted@example.test',
				role: 'member',
				status: 'accepted',
				expiresAt: '2026-09-29T17:00:00Z',
			},
			{
				id: 'invitation-cancelled',
				email: 'cancelled@example.test',
				role: 'admin',
				status: 'canceled',
				expiresAt: '2026-09-29T17:00:00Z',
			},
		]),
		listCustomRoleNames: vi.fn(async () => ['editor', 'reviewer']),
		invite: vi.fn(async () => undefined),
		updateMemberRoles: vi.fn(async () => undefined),
		removeMembership: vi.fn(async () => undefined),
		cancelInvitation: vi.fn(async () => undefined),
	};
	return {
		dependencies: { enforcePermissions, getCurrentUserId, directory },
		enforcePermissions,
		getCurrentUserId,
		directory,
	};
}

function expectNoDirectoryAccess(directory: MembershipDirectory): void {
	for (const operation of Object.values(directory)) expect(operation).not.toHaveBeenCalled();
}

describe('membership service boundary', () => {
	it('normalizes member roles and marks the current user from server-owned identity', async () => {
		const state = setup();
		vi.mocked(state.directory.listMembers).mockResolvedValue([
			{ ...selfMember, providerSecret: 'not-public' } as DirectoryMember,
			{ ...otherMember, providerSecret: 'not-public' } as DirectoryMember,
		]);

		await expect(listAuthorizedMembers(new Headers(), state.dependencies)).resolves.toEqual([
			{
				id: 'membership-self',
				name: 'Current Admin',
				email: 'admin@example.test',
				roles: ['admin', 'member'],
				isSelf: true,
			},
			{
				id: 'membership-other',
				name: null,
				email: 'other@example.test',
				roles: ['member'],
				isSelf: false,
			},
		]);
		expect(state.enforcePermissions).toHaveBeenCalledWith(expect.any(Headers), { member: ['create'] });
		expect(state.getCurrentUserId).toHaveBeenCalledOnce();
	});

	it('returns only pending invitations and projects away provider-only data', async () => {
		const state = setup();
		vi.mocked(state.directory.listInvitations).mockResolvedValue([
			{ ...pendingInvitation, diagnostic: 'not-public' } as DirectoryInvitation,
			{
				id: 'accepted',
				email: 'accepted@example.test',
				role: 'owner',
				status: 'accepted',
				expiresAt: '2026-09-29T17:00:00Z',
			},
		]);

		await expect(listAuthorizedPendingInvitations(new Headers(), state.dependencies)).resolves.toEqual([
			{
				id: 'invitation-pending',
				email: 'invited@example.test',
				roles: ['member', 'admin'],
				expiresAt: '2026-09-30T17:00:00.000Z',
			},
		]);
		expect(state.enforcePermissions).toHaveBeenCalledWith(expect.any(Headers), { invitation: ['create'] });
	});

	it('normalizes string invitation expirations and hides malformed provider values', async () => {
		const valid = setup();
		vi.mocked(valid.directory.listInvitations).mockResolvedValue([
			{ ...pendingInvitation, expiresAt: '2026-09-30T12:00:00-05:00' },
		]);
		await expect(listAuthorizedPendingInvitations(new Headers(), valid.dependencies)).resolves.toEqual([
			{
				id: 'invitation-pending',
				email: 'invited@example.test',
				roles: ['member', 'admin'],
				expiresAt: '2026-09-30T17:00:00.000Z',
			},
		]);

		const invalid = setup();
		vi.mocked(invalid.directory.listInvitations).mockResolvedValue([
			{ ...pendingInvitation, expiresAt: 'provider diagnostic: database value was corrupt' },
		]);
		await expect(listAuthorizedPendingInvitations(new Headers(), invalid.dependencies)).rejects.toMatchObject({
			message: 'Invitation data is unavailable.',
			status: 500,
		});
	});

	it('stops before identity and directory access when list authorization is denied', async () => {
		for (const operation of [listAuthorizedMembers, listAuthorizedPendingInvitations]) {
			const state = setup();
			state.enforcePermissions.mockRejectedValue(new Error('forbidden'));
			await expect(operation(new Headers(), state.dependencies)).rejects.toThrow('forbidden');
			expect(state.getCurrentUserId).not.toHaveBeenCalled();
			expectNoDirectoryAccess(state.directory);
		}
	});

	it('validates every command before authorization or directory access', async () => {
		const invalidOperations = [
			(state: ReturnType<typeof setup>) =>
				inviteAuthorizedMember({ email: 'not-an-email', roles: ['member'] }, new Headers(), state.dependencies),
			(state: ReturnType<typeof setup>) =>
				inviteAuthorizedMember({ email: 'user@example.test', roles: [] }, new Headers(), state.dependencies),
			(state: ReturnType<typeof setup>) =>
				inviteAuthorizedMember(
					{ email: 'user@example.test', roles: Array.from({ length: 21 }, (_, index) => `role-${index}`) },
					new Headers(),
					state.dependencies,
				),
			(state: ReturnType<typeof setup>) =>
				inviteAuthorizedMember({ email: 'user@example.test', roles: ['bad,role'] }, new Headers(), state.dependencies),
			(state: ReturnType<typeof setup>) =>
				inviteAuthorizedMember(
					{ email: 'user@example.test', roles: ['member'], unexpected: true } as never,
					new Headers(),
					state.dependencies,
				),
			(state: ReturnType<typeof setup>) =>
				updateAuthorizedMemberRoles({ memberId: ' ', roles: ['member'] }, new Headers(), state.dependencies),
			(state: ReturnType<typeof setup>) =>
				removeAuthorizedMember({ memberId: '' }, new Headers(), state.dependencies),
			(state: ReturnType<typeof setup>) =>
				cancelAuthorizedInvitation({ invitationId: '' }, new Headers(), state.dependencies),
		];

		for (const operation of invalidOperations) {
			const state = setup();
			await expect(operation(state)).rejects.toThrow();
			expect(state.enforcePermissions).not.toHaveBeenCalled();
			expect(state.getCurrentUserId).not.toHaveBeenCalled();
			expectNoDirectoryAccess(state.directory);
		}
	});

	it('rejects owner invitations before authorization or provider access', async () => {
		const state = setup();
		await expect(
			inviteAuthorizedMember({ email: 'owner@example.test', roles: ['owner'] }, new Headers(), state.dependencies),
		).rejects.toMatchObject({ message: 'Owner invitations are not supported.', status: 400 });
		expect(state.enforcePermissions).not.toHaveBeenCalled();
		expectNoDirectoryAccess(state.directory);
	});

	it('deduplicates and trims roles before sending an invitation', async () => {
		const state = setup();
		await inviteAuthorizedMember(
			{ email: ' new@example.test ', roles: [' member ', 'member', 'admin'] },
			new Headers(),
			state.dependencies,
		);
		expect(state.directory.invite).toHaveBeenCalledWith({
			email: 'new@example.test',
			roles: ['member', 'admin'],
			resend: true,
		});
	});

	it('requires ac:read and validates custom roles before invitation or assignment', async () => {
		const invite = setup();
		await inviteAuthorizedMember(
			{ email: 'editor@example.test', roles: ['member', 'editor'] },
			new Headers(),
			invite.dependencies,
		);
		expect(invite.enforcePermissions.mock.calls.map((call) => call[1])).toEqual([
			{ invitation: ['create'] },
			{ ac: ['read'] },
		]);
		expect(invite.directory.listCustomRoleNames).toHaveBeenCalledOnce();

		const update = setup();
		await updateAuthorizedMemberRoles(
			{ memberId: otherMember.id, roles: ['reviewer'] },
			new Headers(),
			update.dependencies,
		);
		expect(update.enforcePermissions.mock.calls.map((call) => call[1])).toEqual([
			{ member: ['update'] },
			{ ac: ['read'] },
		]);
	});

	it('validates direct invite/edit route capabilities before exact authorization', async () => {
		const invite = setup();
		await expect(
			requireAuthorizedMembershipRouteCapability('invite', new Headers(), invite.dependencies),
		).resolves.toBe(true);
		expect(invite.enforcePermissions).toHaveBeenCalledWith(expect.any(Headers), { invitation: ['create'] });

		const edit = setup();
		await expect(requireAuthorizedMembershipRouteCapability('edit', new Headers(), edit.dependencies)).resolves.toBe(true);
		expect(edit.enforcePermissions).toHaveBeenCalledWith(expect.any(Headers), { member: ['update'] });

		const invalid = setup();
		await expect(
			requireAuthorizedMembershipRouteCapability('delete', new Headers(), invalid.dependencies),
		).rejects.toThrow();
		expect(invalid.enforcePermissions).not.toHaveBeenCalled();
		expectNoDirectoryAccess(invalid.directory);

		const invalidTarget = setup();
		await expect(
			readAuthorizedMemberForRoleEdit(' ', new Headers(), invalidTarget.dependencies),
		).rejects.toThrow();
		expect(invalidTarget.enforcePermissions).not.toHaveBeenCalled();
		expect(invalidTarget.getCurrentUserId).not.toHaveBeenCalled();
		expectNoDirectoryAccess(invalidTarget.directory);
	});

	it('reads one normalized role-edit target with member:update rather than list authority', async () => {
		const state = setup();
		await expect(
			readAuthorizedMemberForRoleEdit(` ${otherMember.id} `, new Headers(), state.dependencies),
		).resolves.toEqual({
			id: otherMember.id,
			name: null,
			email: 'other@example.test',
			roles: ['member'],
			isSelf: false,
		});
		expect(state.enforcePermissions.mock.calls.map((call) => call[1])).toEqual([{ member: ['update'] }]);
		expect(state.directory.getMember).toHaveBeenCalledWith(otherMember.id);
		expect(state.directory.listMembers).not.toHaveBeenCalled();
	});

	it('does not inspect role names or mutate after ac:read is denied', async () => {
		const state = setup();
		state.enforcePermissions.mockImplementation(async (_headers, permissions) => {
			if ('ac' in permissions) throw new Error('no role visibility');
		});
		await expect(
			inviteAuthorizedMember(
				{ email: 'editor@example.test', roles: ['editor'] },
				new Headers(),
				state.dependencies,
			),
		).rejects.toThrow('no role visibility');
		expect(state.directory.listCustomRoleNames).not.toHaveBeenCalled();
		expect(state.directory.listInvitations).not.toHaveBeenCalled();
		expect(state.directory.invite).not.toHaveBeenCalled();
	});

	it('rejects unknown custom roles without mutating membership', async () => {
		const state = setup();
		await expect(
			updateAuthorizedMemberRoles(
				{ memberId: otherMember.id, roles: ['missing-role'] },
				new Headers(),
				state.dependencies,
			),
		).rejects.toMatchObject({ message: 'Role not found: missing-role', status: 404 });
		expect(state.getCurrentUserId).toHaveBeenCalledOnce();
		expect(state.directory.getMember).toHaveBeenCalledWith(otherMember.id);
		expect(state.directory.updateMemberRoles).not.toHaveBeenCalled();
	});

	it('requires ac:read before assigning owner even though owner is built in', async () => {
		const state = setup();
		state.enforcePermissions.mockImplementation(async (_headers, permissions) => {
			if ('ac' in permissions) throw new Error('no role management authority');
		});
		await expect(
			updateAuthorizedMemberRoles(
				{ memberId: otherMember.id, roles: ['owner'] },
				new Headers(),
				state.dependencies,
			),
		).rejects.toThrow('no role management authority');
		expect(state.enforcePermissions.mock.calls.map((call) => call[1])).toEqual([
			{ member: ['update'] },
			{ ac: ['read'] },
		]);
		expect(state.directory.listCustomRoleNames).not.toHaveBeenCalled();
		expect(state.directory.updateMemberRoles).not.toHaveBeenCalled();
	});

	it('blocks update/remove of owner and custom-role targets when ac:read is denied', async () => {
		for (const role of ['owner', 'member,editor']) {
			const update = setup();
			vi.mocked(update.directory.getMember).mockResolvedValue({ ...otherMember, role });
			update.enforcePermissions.mockImplementation(async (_headers, permissions) => {
				if ('ac' in permissions) throw new Error('no role management authority');
			});
			await expect(
				updateAuthorizedMemberRoles(
					{ memberId: otherMember.id, roles: ['member'] },
					new Headers(),
					update.dependencies,
				),
			).rejects.toThrow('no role management authority');
			expect(update.enforcePermissions.mock.calls.map((call) => call[1])).toEqual([
				{ member: ['update'] },
				{ ac: ['read'] },
			]);
			expect(update.directory.updateMemberRoles).not.toHaveBeenCalled();

			const remove = setup();
			vi.mocked(remove.directory.getMember).mockResolvedValue({ ...otherMember, role });
			remove.enforcePermissions.mockImplementation(async (_headers, permissions) => {
				if ('ac' in permissions) throw new Error('no role management authority');
			});
			await expect(
				removeAuthorizedMember({ memberId: otherMember.id }, new Headers(), remove.dependencies),
			).rejects.toThrow('no role management authority');
			expect(remove.enforcePermissions.mock.calls.map((call) => call[1])).toEqual([
				{ member: ['delete'] },
				{ ac: ['read'] },
			]);
			expect(remove.directory.removeMembership).not.toHaveBeenCalled();
		}
	});

	it('guards a privileged role-edit target with ac:read', async () => {
		const state = setup();
		vi.mocked(state.directory.getMember).mockResolvedValue({ ...otherMember, role: 'reviewer' });
		state.enforcePermissions.mockImplementation(async (_headers, permissions) => {
			if ('ac' in permissions) throw new Error('no role management authority');
		});
		await expect(
			readAuthorizedMemberForRoleEdit(otherMember.id, new Headers(), state.dependencies),
		).rejects.toThrow('no role management authority');
		expect(state.enforcePermissions.mock.calls.map((call) => call[1])).toEqual([
			{ member: ['update'] },
			{ ac: ['read'] },
		]);
	});

	it('resends a pending invitation when the normalized email and role set match', async () => {
		const state = setup();
		await inviteAuthorizedMember(
			{ email: 'INVITED@example.test', roles: ['admin', 'member', 'admin'] },
			new Headers(),
			state.dependencies,
		);
		expect(state.directory.invite).toHaveBeenCalledWith({
			email: 'INVITED@example.test',
			roles: ['admin', 'member'],
			resend: true,
		});
	});

	it('returns a stable conflict for a pending invitation with a changed role set', async () => {
		const state = setup();
		await expect(
			inviteAuthorizedMember(
				{ email: 'invited@example.test', roles: ['member'] },
				new Headers(),
				state.dependencies,
			),
		).rejects.toMatchObject({
			message: 'A pending invitation already exists with different roles. Cancel it before changing roles.',
			status: 409,
		});
		expect(state.directory.invite).not.toHaveBeenCalled();
	});

	it('ignores non-pending invitations when deciding whether to resend', async () => {
		const state = setup();
		vi.mocked(state.directory.listInvitations).mockResolvedValue([
			{
				id: 'old',
				email: 'returning@example.test',
				role: 'admin',
				status: 'accepted',
				expiresAt: '2026-09-29T17:00:00Z',
			},
		]);
		await inviteAuthorizedMember(
			{ email: 'returning@example.test', roles: ['member'] },
			new Headers(),
			state.dependencies,
		);
		expect(state.directory.invite).toHaveBeenCalledOnce();
	});

	it('uses the exact permission and normalized command for each mutation', async () => {
		const update = setup();
		await updateAuthorizedMemberRoles(
			{ memberId: ` ${otherMember.id} `, roles: [' member ', 'member', 'admin'] },
			new Headers(),
			update.dependencies,
		);
		expect(update.enforcePermissions).toHaveBeenCalledWith(expect.any(Headers), { member: ['update'] });
		expect(update.directory.updateMemberRoles).toHaveBeenCalledWith({
			memberId: otherMember.id,
			roles: ['member', 'admin'],
		});

		const remove = setup();
		await removeAuthorizedMember({ memberId: ` ${otherMember.id} ` }, new Headers(), remove.dependencies);
		expect(remove.enforcePermissions).toHaveBeenCalledWith(expect.any(Headers), { member: ['delete'] });
		expect(remove.directory.removeMembership).toHaveBeenCalledWith(otherMember.id);

		const cancel = setup();
		await cancelAuthorizedInvitation(
			{ invitationId: ' invitation-pending ' },
			new Headers(),
			cancel.dependencies,
		);
		expect(cancel.enforcePermissions).toHaveBeenCalledWith(expect.any(Headers), { invitation: ['cancel'] });
		expect(cancel.directory.cancelInvitation).toHaveBeenCalledWith('invitation-pending');
	});

	it('never reaches the directory after a mutation permission denial', async () => {
		const operations = [
			(state: ReturnType<typeof setup>) =>
				inviteAuthorizedMember({ email: 'new@example.test', roles: ['member'] }, new Headers(), state.dependencies),
			(state: ReturnType<typeof setup>) =>
				updateAuthorizedMemberRoles({ memberId: otherMember.id, roles: ['member'] }, new Headers(), state.dependencies),
			(state: ReturnType<typeof setup>) =>
				removeAuthorizedMember({ memberId: otherMember.id }, new Headers(), state.dependencies),
			(state: ReturnType<typeof setup>) =>
				cancelAuthorizedInvitation({ invitationId: 'invitation-pending' }, new Headers(), state.dependencies),
		];

		for (const operation of operations) {
			const state = setup();
			state.enforcePermissions.mockRejectedValue(new Error('forbidden'));
			await expect(operation(state)).rejects.toThrow('forbidden');
			expect(state.getCurrentUserId).not.toHaveBeenCalled();
			expectNoDirectoryAccess(state.directory);
		}
	});

	it('rejects self role mutation and self removal on server-owned user IDs', async () => {
		const read = setup();
		await expect(
			readAuthorizedMemberForRoleEdit(selfMember.id, new Headers(), read.dependencies),
		).rejects.toMatchObject({ message: 'You cannot change your own roles.', status: 400 });

		const update = setup();
		await expect(
			updateAuthorizedMemberRoles(
				{ memberId: selfMember.id, roles: ['member'] },
				new Headers(),
				update.dependencies,
			),
		).rejects.toMatchObject({ message: 'You cannot change your own roles.', status: 400 });
		expect(update.directory.updateMemberRoles).not.toHaveBeenCalled();

		const remove = setup();
		await expect(
			removeAuthorizedMember({ memberId: selfMember.id }, new Headers(), remove.dependencies),
		).rejects.toMatchObject({ message: 'You cannot remove yourself.', status: 400 });
		expect(remove.directory.removeMembership).not.toHaveBeenCalled();
	});

	it('reports a missing member without calling a mutation', async () => {
		const update = setup();
		vi.mocked(update.directory.getMember).mockResolvedValue(null);
		await expect(
			updateAuthorizedMemberRoles(
				{ memberId: 'missing', roles: ['member'] },
				new Headers(),
				update.dependencies,
			),
		).rejects.toMatchObject({ message: 'Member not found.', status: 404 });
		expect(update.directory.updateMemberRoles).not.toHaveBeenCalled();

		const remove = setup();
		vi.mocked(remove.directory.getMember).mockResolvedValue(null);
		await expect(
			removeAuthorizedMember({ memberId: 'missing' }, new Headers(), remove.dependencies),
		).rejects.toMatchObject({ message: 'Member not found.', status: 404 });
		expect(remove.directory.removeMembership).not.toHaveBeenCalled();
	});

	it('removes only the membership through the narrow directory port', async () => {
		const state = setup();
		await removeAuthorizedMember({ memberId: otherMember.id }, new Headers(), state.dependencies);
		expect(state.directory.removeMembership).toHaveBeenCalledWith(otherMember.id);
		expect(Object.keys(state.directory)).not.toContain('deleteUser');
	});
});
