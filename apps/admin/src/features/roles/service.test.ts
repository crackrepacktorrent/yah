import type { Permissions } from '@yah/admin-core/permissions';
import { describe, expect, it, vi } from 'vitest';
import type { CreateRoleCommand, StoredCustomRole, UpdateRoleCommand } from './contracts';
import {
	createAuthorizedRole,
	listAuthorizedRoles,
	requireAuthorizedRoleRouteCapability,
	updateAuthorizedRole,
	type RoleDirectory,
} from './service';

const storedRole: StoredCustomRole = {
	id: 'role-content',
	key: 'content editor',
	permissions: { shortlink: ['edit', 'view', 'edit'], analytics: ['view'] },
	createdAt: '2026-08-26T12:00:00.000Z',
};

const validCreate: CreateRoleCommand = {
	key: ' Content Editor ',
	permissions: { shortlink: ['edit', 'view', 'edit'], analytics: ['view'] },
};

function setup() {
	const enforcePermissions = vi.fn(async (_permissions: Permissions) => undefined);
	const directory: RoleDirectory = {
		listCustomRoles: vi.fn(async () => [storedRole]),
		findCustomRole: vi.fn(async (roleId) => (roleId === storedRole.id ? storedRole : null)),
		createCustomRole: vi.fn(async (key, permissions) => ({
			...storedRole,
			key,
			permissions: permissions as Record<string, string[]>,
		})),
		updateCustomRole: vi.fn(async (roleId, permissions) => ({
			...storedRole,
			id: roleId,
			permissions: permissions as Record<string, string[]>,
		})),
	};
	return {
		dependencies: {
			authorization: { requirePermissions: enforcePermissions, getCurrentUserId: vi.fn(async () => 'test-user') },
			directory,
		},
		directory,
		enforcePermissions,
	};
}

describe('roles service boundary', () => {
	it('validates direct create routes before exact authorization', async () => {
		const invalid = setup();
		await expect(
			requireAuthorizedRoleRouteCapability('edit', invalid.dependencies),
		).rejects.toThrow();
		expect(invalid.enforcePermissions).not.toHaveBeenCalled();

		const valid = setup();
		await expect(
			requireAuthorizedRoleRouteCapability('create', valid.dependencies),
		).resolves.toBe(true);
		expect(valid.enforcePermissions).toHaveBeenCalledWith({ ac: ['create'] });
	});

	it('validates role keys and product-only permissions before authorization or directory access', async () => {
		for (const input of [
			{ ...validCreate, key: 'editors,owners' },
			{ ...validCreate, unexpected: true },
			{ ...validCreate, permissions: { organization: ['update'] } },
			{ ...validCreate, permissions: { shortlink: ['publish'] } },
		]) {
			const state = setup();
			await expect(
				createAuthorizedRole(input as CreateRoleCommand, state.dependencies),
			).rejects.toThrow();
			expect(state.enforcePermissions).not.toHaveBeenCalled();
		expect(state.directory.createCustomRole).not.toHaveBeenCalled();
		}
	});

	it('normalizes keys, permission order, duplicates, and empty grants before creating', async () => {
		const state = setup();
		await expect(
			createAuthorizedRole(
				{
					...validCreate,
					permissions: { analytics: ['view', 'view'], shortlink: [], campaign: ['send', 'view'] },
				},
				state.dependencies,
			),
		).resolves.toEqual({
			ok: true,
			role: {
				id: storedRole.id,
				key: 'content editor',
				permissions: { campaign: ['view', 'send'], analytics: ['view'] },
				createdAt: storedRole.createdAt,
				kind: 'custom',
			},
		});
		expect(state.enforcePermissions).toHaveBeenCalledWith({ ac: ['create'] });
		expect(state.enforcePermissions).toHaveBeenCalledWith({
			campaign: ['view', 'send'],
			analytics: ['view'],
		});
		expect(state.directory.createCustomRole).toHaveBeenCalledWith('content editor', {
			campaign: ['view', 'send'],
			analytics: ['view'],
		});
	});

	it('returns stable create conflicts for built-ins and provider races', async () => {
		const builtIn = setup();
		await expect(
			createAuthorizedRole({ ...validCreate, key: ' Owner ' }, builtIn.dependencies),
		).resolves.toEqual({ ok: false, reason: 'key-conflict' });
		expect(builtIn.directory.createCustomRole).not.toHaveBeenCalled();

		const raced = setup();
		vi.mocked(raced.directory.createCustomRole).mockRejectedValue({
			name: 'RoleDirectoryFailure',
			reason: 'key-conflict',
		});
		await expect(createAuthorizedRole(validCreate, raced.dependencies)).resolves.toEqual({
			ok: false,
			reason: 'key-conflict',
		});
	});

	it('prevents callers from granting product permissions they do not possess', async () => {
		const create = setup();
		create.enforcePermissions.mockImplementation(async (permissions) => {
			if ('shortlink' in permissions) throw new Error('grant escalation');
		});
		await expect(createAuthorizedRole(validCreate, create.dependencies)).rejects.toThrow(
			'grant escalation',
		);
		expect(create.directory.createCustomRole).not.toHaveBeenCalled();

		const update = setup();
		update.enforcePermissions.mockImplementation(async (permissions) => {
			if ('shortlink' in permissions) throw new Error('grant escalation');
		});
		await expect(
			updateAuthorizedRole(
				{ roleId: storedRole.id, permissions: { shortlink: ['delete'] } },
				update.dependencies,
			),
		).rejects.toThrow('grant escalation');
		expect(update.directory.updateCustomRole).not.toHaveBeenCalled();
	});

	it('lists inspectable built-ins and normalized custom roles under read authority', async () => {
		const state = setup();
		const result = await listAuthorizedRoles(state.dependencies);
		expect(state.enforcePermissions).toHaveBeenCalledWith({ ac: ['read'] });
		expect(result.roles.map((role) => [role.id, role.kind])).toEqual([
			['builtin:owner', 'built-in'],
			['builtin:admin', 'built-in'],
			['builtin:member', 'built-in'],
			[storedRole.id, 'custom'],
		]);
		expect(result.roles[0]?.permissions).toMatchObject({
			organization: ['update', 'delete'],
			ac: ['create', 'read', 'update', 'delete'],
		});
		expect(result.roles[3]?.permissions).toEqual({ shortlink: ['view', 'edit'], analytics: ['view'] });
		expect(result.statements).not.toHaveProperty('organization');
	});

	it('fails closed when stored custom roles contain internal permissions', async () => {
		const state = setup();
		vi.mocked(state.directory.listCustomRoles).mockResolvedValue([
			{ ...storedRole, permissions: { organization: ['update'] } },
		]);
		await expect(listAuthorizedRoles(state.dependencies)).rejects.toThrow(
			'Stored custom role role-content is invalid',
		);
	});

	it('fails closed when a stored custom role has a non-canonical or comma-delimited key', async () => {
		for (const key of ['Content Editor', 'content,owner']) {
			const state = setup();
			vi.mocked(state.directory.listCustomRoles).mockResolvedValue([{ ...storedRole, key }]);
			await expect(listAuthorizedRoles(state.dependencies)).rejects.toThrow('has invalid metadata');
		}
	});

	it('does not cross the directory boundary after authorization is denied', async () => {
		const state = setup();
		state.enforcePermissions.mockRejectedValue(new Error('forbidden'));
		await expect(listAuthorizedRoles(state.dependencies)).rejects.toThrow('forbidden');
		expect(state.directory.listCustomRoles).not.toHaveBeenCalled();
	});

	it('keeps role keys immutable and validates updates before authorization', async () => {
		const state = setup();
		await expect(
			updateAuthorizedRole(
				{ roleId: storedRole.id, key: 'renamed', permissions: {} } as UpdateRoleCommand,
				state.dependencies,
			),
		).rejects.toThrow();
		expect(state.enforcePermissions).not.toHaveBeenCalled();
		expect(state.directory.updateCustomRole).not.toHaveBeenCalled();
	});

	it('updates only permissions with exact update authority', async () => {
		const state = setup();
		await expect(
			updateAuthorizedRole(
				{ roleId: ` ${storedRole.id} `, permissions: { shortlink: ['delete', 'view', 'delete'] } },
				state.dependencies,
			),
		).resolves.toMatchObject({
			ok: true,
			role: { id: storedRole.id, key: storedRole.key, permissions: { shortlink: ['view', 'delete'] } },
		});
		expect(state.enforcePermissions).toHaveBeenCalledWith({ ac: ['update'] });
		expect(state.enforcePermissions).toHaveBeenCalledWith({ shortlink: ['view', 'delete'] });
		expect(state.directory.findCustomRole).toHaveBeenCalledWith(storedRole.id);
		expect(state.directory.updateCustomRole).toHaveBeenCalledWith(storedRole.id, {
			shortlink: ['view', 'delete'],
		});
	});

	it('returns stable immutable and missing update outcomes without mutating', async () => {
		const builtIn = setup();
		await expect(
			updateAuthorizedRole({ roleId: 'builtin:owner', permissions: {} }, builtIn.dependencies),
		).resolves.toEqual({ ok: false, reason: 'built-in' });
		expect(builtIn.directory.findCustomRole).not.toHaveBeenCalled();

		const missing = setup();
		await expect(
			updateAuthorizedRole({ roleId: 'missing', permissions: {} }, missing.dependencies),
		).resolves.toEqual({ ok: false, reason: 'not-found' });
		expect(missing.directory.updateCustomRole).not.toHaveBeenCalled();

		const raced = setup();
		vi.mocked(raced.directory.updateCustomRole).mockRejectedValue({
			name: 'RoleDirectoryFailure',
			reason: 'not-found',
		});
		await expect(
			updateAuthorizedRole({ roleId: storedRole.id, permissions: {} }, raced.dependencies),
		).resolves.toEqual({ ok: false, reason: 'not-found' });
	});

});
