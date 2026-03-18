import { createAccessControl } from 'better-auth/plugins/access';
import {
	defaultStatements,
	adminAc,
	ownerAc,
	memberAc,
} from 'better-auth/plugins/organization/access';

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

// Owner: full access to everything
export const roles = {
	owner: ac.newRole({
		...ownerAc.statements,
		shortlink: ['view', 'create', 'edit', 'delete'],
		template: ['view', 'create', 'edit', 'delete', 'set-default'],
		subscriber: ['view', 'create', 'edit', 'delete', 'blocklist'],
		list: ['view', 'create', 'edit', 'delete'],
		bounce: ['view', 'delete', 'clear-all'],
		analytics: ['view'],
	}),
	// Admin: read + write, no destructive actions
	admin: ac.newRole({
		...adminAc.statements,
		shortlink: ['view', 'create', 'edit'],
		template: ['view'],
		subscriber: ['view', 'create', 'edit'],
		list: ['view', 'create', 'edit'],
		bounce: ['view'],
		analytics: ['view'],
	}),
	// Member: analytics only
	member: ac.newRole({
		...memberAc.statements,
		analytics: ['view'],
	}),
};
