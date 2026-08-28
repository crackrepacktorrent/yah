import { describe, expect, it } from 'vitest';
import { AUTH_MAINTENANCE_LOCK_ID, ORG_SLUG } from '@yah/admin-core/constants';
import { getBuiltInRolePermissions } from '@yah/admin-core/permissions';
import { mergePermissionSets, parseMemberRoles } from '@yah/admin-core/role-permissions';

describe('shared admin authorization contract', () => {
	it('pins the canonical organization and startup lock used by both runtimes', () => {
		expect(ORG_SLUG).toBe('yah');
		expect(AUTH_MAINTENANCE_LOCK_ID).toBe(941_741);
	});

	it('unions built-in permissions for comma-separated Better Auth roles', () => {
		const roles = parseMemberRoles('member, admin,member');
		const permissions = mergePermissionSets(roles.map((role) => getBuiltInRolePermissions(role) ?? {}));

		expect(roles).toEqual(['member', 'admin']);
		expect(permissions['analytics']).toContain('view');
		expect(permissions['member']).toEqual(expect.arrayContaining(['create', 'update', 'delete']));
	});
});
