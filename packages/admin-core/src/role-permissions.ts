export type PermissionMap = Record<string, string[]>;

/** Parse Better Auth's JSON-backed dynamic-role permission column. */
export function parseStoredPermissionSet(serialized: string): PermissionMap {
	const value: unknown = JSON.parse(serialized);
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Stored role permissions must be an object.');
	}

	for (const actions of Object.values(value)) {
		if (!Array.isArray(actions) || actions.some((action) => typeof action !== 'string')) {
			throw new Error('Stored role permission actions must be string arrays.');
		}
	}

	return value as PermissionMap;
}

/** Better Auth stores multiple organization roles as a comma-separated value. */
export function parseMemberRoles(role: string | null | undefined): string[] {
	if (!role) return [];
	return [
		...new Set(
			role
				.split(',')
				.map((value) => value.trim())
				.filter(Boolean),
		),
	];
}

export function sameRoleSet(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((role) => right.includes(role));
}

/** A member receives the union of permissions granted by all assigned roles. */
export function mergePermissionSets(permissionSets: ReadonlyArray<Readonly<Record<string, readonly string[]>>>): PermissionMap {
	const merged = new Map<string, Set<string>>();

	for (const permissions of permissionSets) {
		for (const [resource, actions] of Object.entries(permissions)) {
			const current = merged.get(resource) ?? new Set<string>();
			for (const action of actions) current.add(action);
			merged.set(resource, current);
		}
	}

	return Object.fromEntries([...merged].map(([resource, actions]) => [resource, [...actions]]));
}
