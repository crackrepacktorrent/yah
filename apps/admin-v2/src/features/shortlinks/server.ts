import { query } from '@solidjs/router';
import type { CreateShortlinkCommand, EditableShortlink, EditShortlinkCommand, ShortlinkCapability, ShortlinkDetail } from './contracts';
import {
	createAuthorizedShortlink,
	deleteAuthorizedShortlink,
	editAuthorizedShortlink,
	listAuthorizedShortlinks,
	readAuthorizedEditableShortlink,
	readAuthorizedShortlink,
	readAuthorizedShortlinkOverview,
	requireAuthorizedShortlinkCapability,
	resetAuthorizedShortlinkVisits,
} from './service';
import { runProductionRequest } from '~/platform/production-request.server';

async function requestDependencies(headers: Headers) {
	const [{ createAuthorizationContext }, { productionShlinkShortlinkManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/shlink/production-manager.server'),
	]);
	return { authorization: createAuthorizationContext(headers), manager: productionShlinkShortlinkManager };
}

export const listShortlinks = query(async () => {
	'use server';
	return runProductionRequest(async (request) => listAuthorizedShortlinks(await requestDependencies(request.headers)));
}, 'shortlinks');

export const getShortlinkOverview = query(async () => {
	'use server';
	return runProductionRequest(async (request) => readAuthorizedShortlinkOverview(await requestDependencies(request.headers)));
}, 'shortlink-overview');

export const getShortlink = query(async (shortCode: string): Promise<ShortlinkDetail> => {
	'use server';
	return runProductionRequest(async (request) => readAuthorizedShortlink(shortCode, await requestDependencies(request.headers)));
}, 'shortlink');

export const getEditableShortlink = query(async (shortCode: string): Promise<EditableShortlink> => {
	'use server';
	return runProductionRequest(async (request) =>
		readAuthorizedEditableShortlink(shortCode, await requestDependencies(request.headers)),
	);
}, 'editable-shortlink');

export const requireShortlinkCapability = query(async (capability: ShortlinkCapability): Promise<true> => {
	'use server';
	return runProductionRequest(async (request) =>
		requireAuthorizedShortlinkCapability(capability, await requestDependencies(request.headers)),
	);
}, 'shortlink-capability');

export type CreateShortlinkResult = { ok: true; shortCode: string } | { ok: false; message: string };

export async function createShortlink(command: CreateShortlinkCommand): Promise<CreateShortlinkResult> {
	'use server';
	return runProductionRequest(async (request) => {
		const result = await createAuthorizedShortlink(command, await requestDependencies(request.headers));
		return result.ok ? result : { ok: false, message: 'That short code is already in use.' };
	});
}

export async function editShortlink(command: EditShortlinkCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) => editAuthorizedShortlink(command, await requestDependencies(request.headers)));
}

export async function deleteShortlink(shortCode: string): Promise<void> {
	'use server';
	return runProductionRequest(async (request) =>
		deleteAuthorizedShortlink(shortCode, await requestDependencies(request.headers)),
	);
}

export async function resetShortlinkVisits(shortCode: string): Promise<{ deletedCount: number }> {
	'use server';
	return runProductionRequest(async (request) =>
		resetAuthorizedShortlinkVisits(shortCode, await requestDependencies(request.headers)),
	);
}
