/**
 * Check if the current session has a specific permission.
 * Usage: can(session, 'shortlink', 'delete')
 */
export function can(
	session: { permissions?: Record<string, string[]> } | null | undefined,
	resource: string,
	action: string,
): boolean {
	if (!session?.permissions) return false;
	return session.permissions[resource]?.includes(action) ?? false;
}
/**
 * Check if the current session has ANY of the specified permissions.
 * Usage: canAny(session, { shortlink: ['create', 'edit'] })
 */
export function canAny(
	session: { permissions?: Record<string, string[]> } | null | undefined,
	permissions: Record<string, string[]>,
): boolean {
	if (!session?.permissions) return false;
	for (const [resource, actions] of Object.entries(permissions)) {
		for (const action of actions) {
			if (session.permissions[resource]?.includes(action)) return true;
		}
	}
	return false;
}
