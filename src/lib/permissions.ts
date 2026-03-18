import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/organization/access';

export const statements = {
	...defaultStatements,
	shortlink: ['view', 'create', 'edit', 'delete'],
	template: ['view', 'create', 'edit', 'delete', 'set-default'],
	subscriber: ['view', 'create', 'edit', 'delete', 'blocklist'],
	list: ['view', 'create', 'edit', 'delete'],
	bounce: ['view', 'delete', 'clear-all'],
	analytics: ['view'],
} as const;

export const ac = createAccessControl(statements);

// Built-in role permissions — pre-defined, shown as read-only in the Roles page.
// Custom roles are created dynamically via the Roles page.
export const defaultRolePermissions: Record<string, Record<string, string[]>> = {
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
		analytics: ['view'],
	},
	admin: {
		member: ['create', 'update', 'delete'],
		invitation: ['create', 'cancel'],
		shortlink: ['view', 'create', 'edit'],
		template: ['view'],
		subscriber: ['view', 'create', 'edit'],
		list: ['view', 'create', 'edit'],
		bounce: ['view'],
		analytics: ['view'],
	},
	member: {
		analytics: ['view'],
	},
};

// Static roles for better-auth's organization plugin
export const roles = {
	owner: ac.newRole(defaultRolePermissions.owner as any),
	admin: ac.newRole(defaultRolePermissions.admin as any),
	member: ac.newRole(defaultRolePermissions.member as any),
};
