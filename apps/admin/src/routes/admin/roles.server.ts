import { query } from '@solidjs/router';
import { getWebRequest } from '@solidjs/start/http';
import { auth } from '~/server/auth';
import { statements, defaultRolePermissions } from '~/lib/permissions';
import { withPermissions } from '~/server/auth-helpers';

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listRoles = query(async () => {
	'use server';
	return withPermissions({ ac: ['read'] }, async () => {
		const request = getWebRequest();
		const dynamicRoles = await auth.api.listOrgRoles({ headers: request.headers });

		const builtIn = Object.entries(defaultRolePermissions).map(([name, permission]) => ({
			id: `builtin:${name}`,
			role: name,
			permission: permission as Record<string, string[]>,
			createdAt: new Date(0),
			builtIn: true as const,
		}));

		const custom = (dynamicRoles ?? []).map((r) => ({
			id: r.id,
			role: r.role,
			permission: (r.permission ?? {}) as Record<string, string[]>,
			createdAt: new Date(r.createdAt),
			builtIn: false as const,
		}));

		return { roles: [...builtIn, ...custom], statements };
	});
}, 'listRoles');

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createRole(data: { role: string; permissions: Record<string, string[]> }): Promise<void> {
	'use server';
	return withPermissions({ ac: ['create'] }, async () => {
		const request = getWebRequest();
		await auth.api.createOrgRole({
			headers: request.headers,
			body: { role: data.role, permission: data.permissions },
		});
	});
}

export async function updateRole(data: {
	roleId: string;
	roleName?: string;
	permissions?: Record<string, string[]>;
}): Promise<void> {
	'use server';
	return withPermissions({ ac: ['update'] }, async () => {
		const request = getWebRequest();
		const body: { permission?: Record<string, string[]>; roleName?: string } = {};
		if (data.permissions) body.permission = data.permissions;
		if (data.roleName) body.roleName = data.roleName;
		await auth.api.updateOrgRole({
			headers: request.headers,
			body: { roleId: data.roleId, data: body },
		});
	});
}

export async function deleteRole(roleId: string): Promise<void> {
	'use server';
	return withPermissions({ ac: ['delete'] }, async () => {
		const request = getWebRequest();
		await auth.api.deleteOrgRole({ headers: request.headers, body: { roleId } });
	});
}
