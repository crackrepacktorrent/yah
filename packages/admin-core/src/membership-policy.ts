import { getBuiltInRolePermissions } from './permissions';
import { parseMemberRoles } from './role-permissions';

/** Owner and custom-role targets require access-control catalog visibility. */
export function rolesRequireAccessControl(roles: string | readonly string[]): boolean {
	const roleNames = typeof roles === 'string' ? parseMemberRoles(roles) : roles;
	return roleNames.some((role) => role === 'owner' || !getBuiltInRolePermissions(role));
}

/** Shared discoverability policy; commands must enforce the same rule server-side. */
export function canManageMemberTarget(input: {
	isSelf: boolean;
	roles: readonly string[];
	canMutate: boolean;
	canReadAccessControl: boolean;
}): boolean {
	return !input.isSelf && input.canMutate && (!rolesRequireAccessControl(input.roles) || input.canReadAccessControl);
}
