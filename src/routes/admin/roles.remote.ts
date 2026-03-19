import { protectedQuery, protectedCommand } from '$lib/server/auth-helpers';
import { auth } from '$lib/server/auth';
import { getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { statements, defaultRolePermissions } from '$lib/permissions';

export const listRoles = protectedQuery({ ac: ['read'] }, async () => {
	const event = getRequestEvent();

	const dynamicRoles = await auth.api.listOrgRoles({
		headers: event.request.headers,
	});

	// Built-in roles (from code) — always present, read-only
	const builtIn = Object.entries(defaultRolePermissions).map(([name, permission]) => ({
		id: `builtin:${name}`,
		role: name,
		permission,
		createdAt: new Date(0),
		builtIn: true,
	}));

	// Custom roles (from DB) — editable
	const custom = dynamicRoles.map((r) => ({
		id: r.id,
		role: r.role,
		permission: r.permission,
		createdAt: r.createdAt,
		builtIn: false,
	}));

	return { roles: [...builtIn, ...custom], statements };
});

export const createRole = protectedCommand(
	{ ac: ['create'] },
	v.object({
		role: v.pipe(v.string(), v.nonEmpty('Role name is required')),
		permissions: v.record(v.string(), v.array(v.string())),
	}),
	async ({ role, permissions }) => {
		const event = getRequestEvent();
		return auth.api.createOrgRole({
			headers: event.request.headers,
			body: { role, permission: permissions },
		});
	},
);

export const updateRole = protectedCommand(
	{ ac: ['update'] },
	v.object({
		roleId: v.string(),
		roleName: v.optional(v.string()),
		permissions: v.optional(v.record(v.string(), v.array(v.string()))),
	}),
	async ({ roleId, roleName, permissions }) => {
		const event = getRequestEvent();

		const data: { permission?: Record<string, string[]>; roleName?: string } = {};
		if (permissions) data.permission = permissions;
		if (roleName) data.roleName = roleName;

		return auth.api.updateOrgRole({
			headers: event.request.headers,
			body: { roleId, data },
		});
	},
);

export const deleteRole = protectedCommand(
	{ ac: ['delete'] },
	v.string(),
	async (roleId) => {
		const event = getRequestEvent();
		return auth.api.deleteOrgRole({
			headers: event.request.headers,
			body: { roleId },
		});
	},
);
