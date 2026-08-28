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
import { runProductionRequest } from '~/platform/production-request.server';

async function requestDependencies(headers: Headers) {
	const [{ createAuthorizationContext }, { createProductionRoleDirectory }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/platform/auth/role-directory.server'),
	]);
	return { authorization: createAuthorizationContext(headers), directory: createProductionRoleDirectory(headers) };
}

export const listRoles = query(async (): Promise<RoleCatalog> => {
	'use server';
	return runProductionRequest(async (request) => listAuthorizedRoles(await requestDependencies(request.headers)));
}, 'roles');

export const requireRoleRouteCapability = query(async (capability: RoleRouteCapability): Promise<true> => {
	'use server';
	return runProductionRequest(async (request) =>
		requireAuthorizedRoleRouteCapability(capability, await requestDependencies(request.headers)),
	);
}, 'role-route-capability');

export async function createRole(command: CreateRoleCommand): Promise<CreateRoleOutcome> {
	'use server';
	return runProductionRequest(async (request) =>
		createAuthorizedRole(command, await requestDependencies(request.headers)),
	);
}

export async function updateRole(command: UpdateRoleCommand): Promise<UpdateRoleOutcome> {
	'use server';
	return runProductionRequest(async (request) =>
		updateAuthorizedRole(command, await requestDependencies(request.headers)),
	);
}
