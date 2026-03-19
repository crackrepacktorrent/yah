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
