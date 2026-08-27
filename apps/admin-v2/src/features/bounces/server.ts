import { query } from '@solidjs/router';
import type { BouncePage, BounceSummary, DeleteBouncesCommand, ListBouncesQuery } from './contracts';
import {
	clearAuthorizedBounces,
	clearAuthorizedSubscriberBounces,
	deleteAuthorizedBounces,
	listAuthorizedBounces,
	listAuthorizedSubscriberBounces,
} from './service';
import { surfaceError } from '~/platform/errors';
import { getServerRequest } from '~/platform/request';
import { requireProductionRuntime } from '~/platform/runtime.server';

async function dependencies() {
	const [{ enforcePermissions }, { productionBounceManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-bounce-manager.server'),
	]);
	return { enforcePermissions, manager: productionBounceManager };
}

export const listBounces = query(async (input: ListBouncesQuery): Promise<BouncePage> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await listAuthorizedBounces(input, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'bounces');

export const listSubscriberBounces = query(async (subscriberId: number): Promise<BounceSummary[]> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await listAuthorizedSubscriberBounces(subscriberId, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'subscriber-bounces');

export async function deleteBounces(command: DeleteBouncesCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await deleteAuthorizedBounces(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function clearAllBounces(): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await clearAuthorizedBounces(request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function clearSubscriberBounces(subscriberId: number): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await clearAuthorizedSubscriberBounces(subscriberId, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}
