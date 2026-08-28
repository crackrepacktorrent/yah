import { query } from '@solidjs/router';
import type { BouncePage, BounceSummary, DeleteBouncesCommand, ListBouncesQuery } from './contracts';
import {
	clearAuthorizedBounces,
	clearAuthorizedSubscriberBounces,
	deleteAuthorizedBounces,
	listAuthorizedBounces,
	listAuthorizedSubscriberBounces,
} from './service';
import { runProductionRequest } from '~/platform/production-request.server';

async function requestDependencies(headers: Headers) {
	const [{ createAuthorizationContext }, { productionBounceManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-bounce-manager.server'),
	]);
	return { authorization: createAuthorizationContext(headers), manager: productionBounceManager };
}

export const listBounces = query(async (input: ListBouncesQuery): Promise<BouncePage> => {
	'use server';
	return runProductionRequest(async (request) => listAuthorizedBounces(input, await requestDependencies(request.headers)));
}, 'bounces');

export const listSubscriberBounces = query(async (subscriberId: number): Promise<BounceSummary[]> => {
	'use server';
	return runProductionRequest(async (request) =>
		listAuthorizedSubscriberBounces(subscriberId, await requestDependencies(request.headers)),
	);
}, 'subscriber-bounces');

export async function deleteBounces(command: DeleteBouncesCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) => deleteAuthorizedBounces(command, await requestDependencies(request.headers)));
}

export async function clearAllBounces(): Promise<void> {
	'use server';
	return runProductionRequest(async (request) => clearAuthorizedBounces(await requestDependencies(request.headers)));
}

export async function clearSubscriberBounces(subscriberId: number): Promise<void> {
	'use server';
	return runProductionRequest(async (request) =>
		clearAuthorizedSubscriberBounces(subscriberId, await requestDependencies(request.headers)),
	);
}
