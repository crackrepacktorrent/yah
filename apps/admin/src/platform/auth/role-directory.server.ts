import 'server-only';
import { parseStoredPermissionSet } from '@yah/admin-core/role-permissions';
import { RoleDirectoryFailure, type StoredCustomRole } from '~/features/roles/contracts';
import type { RoleDirectory } from '~/features/roles/service';
import { auth, canonicalOrganizationId, pool } from './production-server';

type RawStoredRole = {
	id: string;
	role: string;
	permission: unknown;
	createdAt: Date | string;
};

function permissionMap(value: unknown): Record<string, string[]> {
	if (typeof value === 'string') return parseStoredPermissionSet(value);
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Stored role permissions must be an object.');

	const permissions: Record<string, string[]> = {};
	for (const [resource, actions] of Object.entries(value)) {
		if (!Array.isArray(actions) || actions.some((action) => typeof action !== 'string')) {
			throw new Error('Stored role permission actions must be string arrays.');
		}
		permissions[resource] = [...actions] as string[];
	}
	return permissions;
}

function storedRole(role: RawStoredRole): StoredCustomRole {
	const createdAt = role.createdAt instanceof Date ? role.createdAt : new Date(role.createdAt);
	if (!role.id || !role.role || Number.isNaN(createdAt.valueOf())) throw new Error('Stored role metadata is invalid.');
	return {
		id: role.id,
		key: role.role,
		permissions: permissionMap(role.permission),
		createdAt: createdAt.toISOString(),
	};
}

export function createProductionRoleDirectory(headers: Headers): RoleDirectory {
	return {
		async listCustomRoles() {
			const roles = await auth.api.listOrgRoles({
				headers,
				query: { organizationId: canonicalOrganizationId },
			});
			return (roles ?? []).map((role) => storedRole(role));
		},
		async findCustomRole(roleId) {
			const { adapter } = await auth.$context;
			const role = await adapter.findOne<RawStoredRole>({
				model: 'organizationRole',
				where: [
					{ field: 'organizationId', value: canonicalOrganizationId },
					{ field: 'id', value: roleId },
				],
			});
			return role ? storedRole(role) : null;
		},
		async createCustomRole(key, permissions) {
			const result = await pool.query<RawStoredRole>(
				`INSERT INTO "organizationRole" (id, "organizationId", role, permission, "createdAt", "updatedAt")
				 VALUES ($1, $2, $3, $4, NOW(), NOW())
				 ON CONFLICT ("organizationId", role) DO NOTHING
				 RETURNING id, role, permission, "createdAt"`,
				[crypto.randomUUID(), canonicalOrganizationId, key, JSON.stringify(permissions)],
			);
			const role = result.rows[0];
			if (!role) throw new RoleDirectoryFailure('key-conflict');
			return storedRole(role);
		},
		async updateCustomRole(roleId, permissions) {
			const result = await pool.query<RawStoredRole>(
				`UPDATE "organizationRole"
				 SET permission = $3, "updatedAt" = NOW()
				 WHERE "organizationId" = $1 AND id = $2
				 RETURNING id, role, permission, "createdAt"`,
				[canonicalOrganizationId, roleId, JSON.stringify(permissions)],
			);
			const role = result.rows[0];
			if (!role) throw new RoleDirectoryFailure('not-found');
			return storedRole(role);
		},
	};
}
