import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/organization/access';

/** Permissions that custom product roles may grant through the admin. */
export const customRoleStatements = {
	shortlink: ['view', 'create', 'edit', 'delete'],
	template: ['view', 'create', 'edit', 'delete', 'set-default'],
	subscriber: ['view', 'create', 'edit', 'delete', 'blocklist'],
	list: ['view', 'create', 'edit', 'delete'],
	bounce: ['view', 'delete', 'clear-all'],
	campaign: ['view', 'create', 'edit', 'delete', 'send'],
	analytics: ['view'],
	settings: ['view', 'edit'],
} as const;

export const statements = {
	...defaultStatements,
	...customRoleStatements,
} as const;

export const ac = createAccessControl(statements);

export type PermissionResource = keyof typeof statements;
export type PermissionAction<Resource extends PermissionResource> = (typeof statements)[Resource][number];
export type Permissions = {
	[Resource in PermissionResource]?: PermissionAction<Resource>[];
};

export function isPermissionResource(resource: string): resource is PermissionResource {
	return Object.hasOwn(statements, resource);
}

export type CustomRolePermissionResource = keyof typeof customRoleStatements;

export function isCustomRolePermissionResource(resource: string): resource is CustomRolePermissionResource {
	return Object.hasOwn(customRoleStatements, resource);
}

/**
 * Copies only product permissions and known actions. Use this when cloning a
 * built-in role; never silently sanitize an untrusted server command.
 */
export function pickCustomRolePermissions(permissions: Record<string, readonly string[]>): Record<string, string[]> {
	const picked: Record<string, string[]> = {};
	for (const [resource, actions] of Object.entries(permissions)) {
		if (!isCustomRolePermissionResource(resource)) continue;
		const allowed = customRoleStatements[resource] as readonly string[];
		const selected = [...new Set(actions.filter((action) => allowed.includes(action)))];
		if (selected.length > 0) picked[resource] = selected;
	}
	return picked;
}

export const defaultRolePermissions: Record<string, Permissions> = {
	owner: {
		organization: ['update', 'delete'],
		member: ['create', 'update', 'delete'],
		invitation: ['create', 'cancel'],
		team: ['create', 'update', 'delete'],
		ac: ['create', 'read', 'update', 'delete'],
		shortlink: ['view', 'create', 'edit', 'delete'],
		template: ['view', 'create', 'edit', 'delete', 'set-default'],
		subscriber: ['view', 'create', 'edit', 'delete', 'blocklist'],
		list: ['view', 'create', 'edit', 'delete'],
		bounce: ['view', 'delete', 'clear-all'],
		campaign: ['view', 'create', 'edit', 'delete', 'send'],
		analytics: ['view'],
		settings: ['view', 'edit'],
	},
	admin: {
		member: ['create', 'update', 'delete'],
		invitation: ['create', 'cancel'],
		shortlink: ['view', 'create', 'edit'],
		template: ['view'],
		subscriber: ['view', 'create', 'edit'],
		list: ['view', 'create', 'edit'],
		bounce: ['view'],
		campaign: ['view', 'create', 'edit'],
		analytics: ['view'],
		settings: ['view'],
	},
	member: {
		analytics: ['view'],
	},
};

export function getBuiltInRolePermissions(roleName: string): Permissions | undefined {
	return Object.hasOwn(defaultRolePermissions, roleName) ? defaultRolePermissions[roleName] : undefined;
}

// Better Auth's exact Subset type cannot be derived from the mapped public
// Permissions type above. Keep this cast at the adapter boundary only.
export const roles = {
	owner: ac.newRole(defaultRolePermissions['owner'] as never),
	admin: ac.newRole(defaultRolePermissions['admin'] as never),
	member: ac.newRole(defaultRolePermissions['member'] as never),
};
