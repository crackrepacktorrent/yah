import { customRoleStatements, type CustomRolePermissionResource } from '@yah/admin-core/permissions';
import * as v from 'valibot';

const nonBlankText = v.pipe(v.string(), v.trim(), v.minLength(1));

export const RoleIdSchema = v.pipe(nonBlankText, v.maxLength(255, 'Role identifier is too long.'));
export const RoleKeySchema = v.pipe(
	nonBlankText,
	v.maxLength(128, 'Role name is too long.'),
	v.check((key) => !key.includes(','), 'Role names cannot contain commas.'),
	v.transform((key) => key.toLowerCase()),
);

const permissionActions = v.pipe(
	v.array(v.pipe(v.string(), v.maxLength(128))),
	v.maxLength(100),
);
export const CustomRolePermissionsSchema = v.record(v.pipe(v.string(), v.maxLength(128)), permissionActions);
export const CreateRoleCommandSchema = v.strictObject({
	key: RoleKeySchema,
	permissions: CustomRolePermissionsSchema,
});
export const UpdateRoleCommandSchema = v.strictObject({
	roleId: RoleIdSchema,
	permissions: CustomRolePermissionsSchema,
});
export const RoleRouteCapabilitySchema = v.picklist(['create'] as const);

export type CustomRolePermissions = {
	[Resource in CustomRolePermissionResource]?: Array<(typeof customRoleStatements)[Resource][number]>;
};

type RoleBase<TPermissions> = {
	id: string;
	key: string;
	permissions: TPermissions;
};

export type BuiltInRole = RoleBase<Record<string, string[]>> & {
	kind: 'built-in';
	createdAt: null;
};

export type CustomRole = RoleBase<CustomRolePermissions> & {
	kind: 'custom';
	createdAt: string;
};

export type Role = BuiltInRole | CustomRole;

export type RoleCatalog = {
	roles: Role[];
	statements: typeof customRoleStatements;
};

export type StoredCustomRole = {
	id: string;
	key: string;
	permissions: Record<string, string[]>;
	createdAt: string;
};

export type CreateRoleCommand = v.InferInput<typeof CreateRoleCommandSchema>;
export type UpdateRoleCommand = v.InferInput<typeof UpdateRoleCommandSchema>;
export type RoleRouteCapability = v.InferOutput<typeof RoleRouteCapabilitySchema>;

export type CreateRoleOutcome = { ok: true; role: CustomRole } | { ok: false; reason: 'key-conflict' };
export type UpdateRoleOutcome =
	| { ok: true; role: CustomRole }
	| { ok: false; reason: 'built-in' | 'not-found' };
/** A diagnostic-free provider result that is safe for the service to classify. */
export class RoleDirectoryFailure extends Error {
	constructor(public readonly reason: 'key-conflict' | 'not-found') {
		super(`Role directory operation failed: ${reason}.`);
		this.name = 'RoleDirectoryFailure';
	}
}

/** Start Mode may duplicate custom-error constructors across lazy chunks. */
export function isRoleDirectoryFailure(error: unknown): error is RoleDirectoryFailure {
	return (
		typeof error === 'object' &&
		error !== null &&
		'name' in error &&
		error.name === 'RoleDirectoryFailure' &&
		'reason' in error &&
		['key-conflict', 'not-found'].includes(String(error.reason))
	);
}
