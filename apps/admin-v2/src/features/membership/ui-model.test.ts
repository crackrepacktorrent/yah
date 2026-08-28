import { describe, expect, it } from 'vitest';
import { buildAssignableRoleOptions, canManageMember, isProtectedRoleSet, roleBadgeKind } from './ui-model';

describe('membership UI model', () => {
	it('limits callers without ac:read to admin and member', () => {
		expect(
			buildAssignableRoleOptions({
				mode: 'edit',
				canReadAccessControl: false,
				catalogRoleKeys: ['owner', 'editor'],
				assignedRoles: ['editor'],
			}),
		).toEqual([
			{ key: 'admin', label: 'Admin', missing: false },
			{ key: 'member', label: 'Member', missing: false },
		]);
	});

	it('allows ac:read callers to assign built-ins and custom roles without duplicate keys', () => {
		expect(
			buildAssignableRoleOptions({
				mode: 'edit',
				canReadAccessControl: true,
				catalogRoleKeys: ['owner', 'admin', 'member', 'editor', 'editor'],
			}),
		).toEqual([
			{ key: 'owner', label: 'Owner', missing: false },
			{ key: 'admin', label: 'Admin', missing: false },
			{ key: 'member', label: 'Member', missing: false },
			{ key: 'editor', label: 'editor', missing: false },
		]);
	});

	it('never offers owner for invitations', () => {
		const options = buildAssignableRoleOptions({
			mode: 'invite',
			canReadAccessControl: true,
			catalogRoleKeys: ['owner', 'admin', 'member', 'editor'],
		});
		expect(options.map((option) => option.key)).toEqual(['admin', 'member', 'editor']);
	});

	it('preserves assigned roles absent from the catalog and labels them missing', () => {
		const options = buildAssignableRoleOptions({
			mode: 'edit',
			canReadAccessControl: true,
			catalogRoleKeys: ['editor'],
			assignedRoles: ['member', 'deleted-role', 'deleted-role'],
		});
		expect(options.at(-1)).toEqual({ key: 'deleted-role', label: 'deleted-role (missing)', missing: true });
	});

	it('hides self controls and protects owner/custom targets without ac:read', () => {
		expect(canManageMember({ isSelf: true, roles: ['member'] }, true, true)).toBe(false);
		expect(canManageMember({ isSelf: false, roles: ['member'] }, true, false)).toBe(true);
		expect(canManageMember({ isSelf: false, roles: ['owner'] }, true, false)).toBe(false);
		expect(canManageMember({ isSelf: false, roles: ['editor'] }, true, false)).toBe(false);
		expect(canManageMember({ isSelf: false, roles: ['editor'] }, true, true)).toBe(true);
		expect(isProtectedRoleSet(['admin', 'member'])).toBe(false);
		expect(isProtectedRoleSet(['member', 'editor'])).toBe(true);
	});

	it('uses stable badge variants for built-in emphasis', () => {
		expect(roleBadgeKind('owner')).toBe('owner');
		expect(roleBadgeKind('admin')).toBe('admin');
		expect(roleBadgeKind('member')).toBe('default');
	});
});
