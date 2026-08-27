import { canManageMemberTarget, rolesRequireAccessControl } from '@yah/admin-core/membership-policy';
import type { AdminMember } from './contracts';

export type RoleOption = {
	key: string;
	label: string;
	missing: boolean;
};

const STANDARD_ASSIGNABLE_ROLES = ['admin', 'member'] as const;
const PRIVILEGED_BUILT_IN_ROLES = ['owner', ...STANDARD_ASSIGNABLE_ROLES] as const;

function displayRole(role: string): string {
	if (role === 'owner') return 'Owner';
	if (role === 'admin') return 'Admin';
	if (role === 'member') return 'Member';
	return role;
}

export const isProtectedRoleSet = rolesRequireAccessControl;

export function canManageMember(
	member: Pick<AdminMember, 'isSelf' | 'roles'>,
	canMutate: boolean,
	canReadAccessControl: boolean,
): boolean {
	return canManageMemberTarget({
		isSelf: member.isSelf,
		roles: member.roles,
		canMutate,
		canReadAccessControl,
	});
}

export function buildAssignableRoleOptions(input: {
	mode: 'invite' | 'edit';
	canReadAccessControl: boolean;
	catalogRoleKeys?: readonly string[];
	assignedRoles?: readonly string[];
}): RoleOption[] {
	const permitted = input.canReadAccessControl
		? [...PRIVILEGED_BUILT_IN_ROLES, ...(input.catalogRoleKeys ?? [])]
		: [...STANDARD_ASSIGNABLE_ROLES];
	const permittedForMode = input.mode === 'invite' ? permitted.filter((role) => role !== 'owner') : permitted;
	const known = [...new Set(permittedForMode)];
	const unknownAssigned = input.canReadAccessControl
		? (input.assignedRoles ?? []).filter((role) => !known.includes(role))
		: [];

	return [
		...known.map((key) => ({ key, label: displayRole(key), missing: false })),
		...[...new Set(unknownAssigned)].map((key) => ({ key, label: `${displayRole(key)} (missing)`, missing: true })),
	];
}

export function roleBadgeKind(role: string): 'owner' | 'admin' | 'default' {
	if (role === 'owner') return 'owner';
	if (role === 'admin') return 'admin';
	return 'default';
}
