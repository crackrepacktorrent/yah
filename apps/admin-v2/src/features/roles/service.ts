import {
	customRoleStatements,
	defaultRolePermissions,
	isCustomRolePermissionResource,
	type Permissions,
} from '@yah/admin-core/permissions';
import * as v from 'valibot';
import {
	CreateRoleCommandSchema,
	RoleIdSchema,
	RoleKeySchema,
	RoleRouteCapabilitySchema,
	UpdateRoleCommandSchema,
	isRoleDirectoryFailure,
	type CreateRoleCommand,
	type CreateRoleOutcome,
	type CustomRole,
	type CustomRolePermissions,
	type RoleCatalog,
	type RoleRouteCapability,
	type StoredCustomRole,
	type UpdateRoleCommand,
	type UpdateRoleOutcome,
} from './contracts';
import { createPublicError } from '~/platform/errors';

/** Product-facing operations only; organization scoping belongs to the adapter. */
export type RoleDirectory = {
	listCustomRoles(): Promise<StoredCustomRole[]>;
	findCustomRole(roleId: string): Promise<StoredCustomRole | null>;
	createCustomRole(key: string, permissions: CustomRolePermissions): Promise<StoredCustomRole>;
	updateCustomRole(roleId: string, permissions: CustomRolePermissions): Promise<StoredCustomRole>;
};

export type RoleServiceDependencies = {
	enforcePermissions(headers: Headers, permissions: Permissions): Promise<void>;
	directory: RoleDirectory;
};

function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
	schema: TSchema,
	input: unknown,
): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, input);
	if (!result.success) throw createPublicError(result.issues[0]?.message ?? 'Invalid role data.', 400);
	return result.output;
}

function normalizeCustomPermissions(
	permissions: Record<string, string[]>,
	invalid: (message: string) => never,
): CustomRolePermissions {
	for (const [resource, actions] of Object.entries(permissions)) {
		if (!isCustomRolePermissionResource(resource)) invalid(`Unknown permission resource "${resource}".`);
		const allowed = customRoleStatements[resource] as readonly string[];
		for (const action of actions) {
			if (!allowed.includes(action)) invalid(`Unknown ${resource} action "${action}".`);
		}
	}

	const normalized: Record<string, string[]> = {};
	for (const [resource, allowed] of Object.entries(customRoleStatements)) {
		const requested = new Set(permissions[resource] ?? []);
		const actions = allowed.filter((action) => requested.has(action));
		if (actions.length > 0) normalized[resource] = actions;
	}
	return normalized as CustomRolePermissions;
}

function parseCommandPermissions(permissions: Record<string, string[]>): CustomRolePermissions {
	return normalizeCustomPermissions(permissions, (message) => {
		throw createPublicError(`Invalid request: ${message}`, 400);
	});
}

function normalizeStoredRole(role: StoredCustomRole): CustomRole {
	const id = v.safeParse(RoleIdSchema, role.id);
	const key = v.safeParse(RoleKeySchema, role.key);
	if (
		!id.success ||
		id.output !== role.id ||
		!key.success ||
		key.output !== role.key ||
		Number.isNaN(Date.parse(role.createdAt))
	) {
		throw new Error(`Stored custom role ${role.id} has invalid metadata.`);
	}
	const permissions = normalizeCustomPermissions(role.permissions, (message) => {
		throw new Error(`Stored custom role ${role.id} is invalid: ${message}`);
	});
	return {
		id: role.id,
		key: role.key,
		permissions,
		createdAt: role.createdAt,
		kind: 'custom',
	};
}

function isBuiltInId(roleId: string): boolean {
	return roleId.startsWith('builtin:');
}

async function enforceGrantSubset(
	headers: Headers,
	permissions: CustomRolePermissions,
	dependencies: RoleServiceDependencies,
): Promise<void> {
	if (Object.keys(permissions).length > 0) {
		await dependencies.enforcePermissions(headers, permissions as Permissions);
	}
}

export async function listAuthorizedRoles(
	headers: Headers,
	dependencies: RoleServiceDependencies,
): Promise<RoleCatalog> {
	await dependencies.enforcePermissions(headers, { ac: ['read'] });
	const customRoles = await dependencies.directory.listCustomRoles();
	const builtInRoles = Object.entries(defaultRolePermissions).map(([key, permissions]) => ({
		id: `builtin:${key}`,
		key,
		permissions: Object.fromEntries(
			Object.entries(permissions).map(([resource, actions]) => [resource, [...actions]]),
		),
		createdAt: null,
		kind: 'built-in' as const,
	}));

	return {
		roles: [
			...builtInRoles,
			...customRoles
				.map(normalizeStoredRole)
				.sort((left, right) => left.key.localeCompare(right.key) || left.id.localeCompare(right.id)),
		],
		statements: customRoleStatements,
	};
}

export async function requireAuthorizedRoleRouteCapability(
	input: unknown,
	headers: Headers,
	dependencies: RoleServiceDependencies,
): Promise<true> {
	const capability = parse(RoleRouteCapabilitySchema, input);
	const permissions: Record<RoleRouteCapability, Permissions> = {
		create: { ac: ['create'] },
	};
	await dependencies.enforcePermissions(headers, permissions[capability]);
	return true;
}

export async function createAuthorizedRole(
	input: CreateRoleCommand,
	headers: Headers,
	dependencies: RoleServiceDependencies,
): Promise<CreateRoleOutcome> {
	const command = parse(CreateRoleCommandSchema, input);
	const permissions = parseCommandPermissions(command.permissions);
	await dependencies.enforcePermissions(headers, { ac: ['create'] });

	if (Object.hasOwn(defaultRolePermissions, command.key)) return { ok: false, reason: 'key-conflict' };
	await enforceGrantSubset(headers, permissions, dependencies);

	try {
		const role = await dependencies.directory.createCustomRole(command.key, permissions);
		return { ok: true, role: normalizeStoredRole(role) };
	} catch (error) {
		if (isRoleDirectoryFailure(error) && error.reason === 'key-conflict') {
			return { ok: false, reason: 'key-conflict' };
		}
		throw error;
	}
}

export async function updateAuthorizedRole(
	input: UpdateRoleCommand,
	headers: Headers,
	dependencies: RoleServiceDependencies,
): Promise<UpdateRoleOutcome> {
	const command = parse(UpdateRoleCommandSchema, input);
	const permissions = parseCommandPermissions(command.permissions);
	await dependencies.enforcePermissions(headers, { ac: ['update'] });

	if (isBuiltInId(command.roleId)) return { ok: false, reason: 'built-in' };
	if (!(await dependencies.directory.findCustomRole(command.roleId))) return { ok: false, reason: 'not-found' };
	await enforceGrantSubset(headers, permissions, dependencies);

	try {
		const role = await dependencies.directory.updateCustomRole(command.roleId, permissions);
		return { ok: true, role: normalizeStoredRole(role) };
	} catch (error) {
		if (isRoleDirectoryFailure(error) && error.reason === 'not-found') {
			return { ok: false, reason: 'not-found' };
		}
		throw error;
	}
}
