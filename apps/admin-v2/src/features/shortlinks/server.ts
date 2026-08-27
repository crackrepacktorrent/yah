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
import { surfaceError } from '~/platform/errors';
import { getServerRequest } from '~/platform/request';
import { requireProductionRuntime } from '~/platform/runtime.server';

async function dependencies() {
	const [{ enforcePermissions }, { productionShlinkShortlinkManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/shlink/production-manager.server'),
	]);
	return { enforcePermissions, manager: productionShlinkShortlinkManager };
}

export const listShortlinks = query(async () => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await listAuthorizedShortlinks(request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'shortlinks');

export const getShortlinkOverview = query(async () => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await readAuthorizedShortlinkOverview(request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'shortlink-overview');

export const getShortlink = query(async (shortCode: string): Promise<ShortlinkDetail> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await readAuthorizedShortlink(shortCode, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'shortlink');

export const getEditableShortlink = query(async (shortCode: string): Promise<EditableShortlink> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await readAuthorizedEditableShortlink(shortCode, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'editable-shortlink');

export const requireShortlinkCapability = query(async (capability: ShortlinkCapability): Promise<true> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await requireAuthorizedShortlinkCapability(capability, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'shortlink-capability');

export type CreateShortlinkResult = { ok: true; shortCode: string } | { ok: false; message: string };

export async function createShortlink(command: CreateShortlinkCommand): Promise<CreateShortlinkResult> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		const result = await createAuthorizedShortlink(command, request.headers, await dependencies());
		return result.ok ? result : { ok: false, message: 'That short code is already in use.' };
	} catch (error) {
		surfaceError(error);
	}
}

export async function editShortlink(command: EditShortlinkCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await editAuthorizedShortlink(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function deleteShortlink(shortCode: string): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await deleteAuthorizedShortlink(shortCode, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function resetShortlinkVisits(shortCode: string): Promise<{ deletedCount: number }> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await resetAuthorizedShortlinkVisits(shortCode, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}
