import type { PermissionAction, PermissionResource } from './permissions';

export type PermissionSession = {
	permissions?: Partial<Record<PermissionResource, readonly string[]>>;
};

/**
 * Check if the current session has a specific permission.
 * Usage: can(session, 'shortlink', 'delete')
 */
export function can<Resource extends PermissionResource>(
	session: PermissionSession | null | undefined,
	resource: Resource,
	action: PermissionAction<Resource>,
): boolean {
	if (!session?.permissions) return false;
	return session.permissions[resource]?.includes(action) ?? false;
}
