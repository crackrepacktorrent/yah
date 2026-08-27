import { query } from '@solidjs/router';
import type {
	CreateRoleCommand,
	CreateRoleOutcome,
	RoleCatalog,
	RoleRouteCapability,
	UpdateRoleCommand,
	UpdateRoleOutcome,
} from './contracts';
import {
	createAuthorizedRole,
	listAuthorizedRoles,
	requireAuthorizedRoleRouteCapability,
	updateAuthorizedRole,
} from './service';
import { surfaceError } from '~/platform/errors';
import { getServerRequest } from '~/platform/request';
import { requireProductionRuntime } from '~/platform/runtime.server';

async function dependencies(headers: Headers) {
	const [{ enforcePermissions }, { createProductionRoleDirectory }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/platform/auth/role-directory.server'),
	]);
	return { enforcePermissions, directory: createProductionRoleDirectory(headers) };
}

export const listRoles = query(async (): Promise<RoleCatalog> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await listAuthorizedRoles(request.headers, await dependencies(request.headers));
	} catch (error) {
		surfaceError(error);
	}
}, 'roles');

export const requireRoleRouteCapability = query(async (capability: RoleRouteCapability): Promise<true> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await requireAuthorizedRoleRouteCapability(capability, request.headers, await dependencies(request.headers));
	} catch (error) {
		surfaceError(error);
	}
}, 'role-route-capability');

export async function createRole(command: CreateRoleCommand): Promise<CreateRoleOutcome> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await createAuthorizedRole(command, request.headers, await dependencies(request.headers));
	} catch (error) {
		surfaceError(error);
	}
}

export async function updateRole(command: UpdateRoleCommand): Promise<UpdateRoleOutcome> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await updateAuthorizedRole(command, request.headers, await dependencies(request.headers));
	} catch (error) {
		surfaceError(error);
	}
}
