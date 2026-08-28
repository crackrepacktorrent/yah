import { query } from '@solidjs/router';
import type {
	CreateMailingListCommand,
	MailingList,
	MailingListCapability,
	SetMailingListVisibilityCommand,
	UpdateMailingListCommand,
} from './contracts';
import {
	createAuthorizedMailingList,
	deleteAuthorizedMailingList,
	listAuthorizedMailingLists,
	readAuthorizedMailingList,
	requireAuthorizedMailingListCapability,
	setAuthorizedMailingListVisibility,
	updateAuthorizedMailingList,
} from './service';
import { runProductionRequest } from '~/platform/production-request.server';

async function requestDependencies(headers: Headers) {
	const [{ createAuthorizationContext }, { productionMailingListManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-mailing-list-manager.server'),
	]);
	return { authorization: createAuthorizationContext(headers), manager: productionMailingListManager };
}

export const listMailingLists = query(async (): Promise<MailingList[]> => {
	'use server';
	return runProductionRequest(async (request) => listAuthorizedMailingLists(await requestDependencies(request.headers)));
}, 'mailing-lists');

export const getMailingList = query(async (id: number): Promise<MailingList> => {
	'use server';
	return runProductionRequest(async (request) => readAuthorizedMailingList(id, await requestDependencies(request.headers)));
}, 'mailing-list');

export const requireMailingListCapability = query(async (capability: MailingListCapability): Promise<true> => {
	'use server';
	return runProductionRequest(async (request) =>
		requireAuthorizedMailingListCapability(capability, await requestDependencies(request.headers)),
	);
}, 'mailing-list-capability');

export const getSubscriptionSharingConfig = query(async (): Promise<{ publicSiteUrl: string }> => {
	'use server';
	return runProductionRequest(async (request) => {
		await requireAuthorizedMailingListCapability('view', await requestDependencies(request.headers));
		const { productionConfig } = await import('~/platform/config/production-env.server');
		return { publicSiteUrl: productionConfig.PUBLIC_SITE_URL };
	});
}, 'subscription-sharing-config');

export async function createMailingList(command: CreateMailingListCommand): Promise<{ id: number }> {
	'use server';
	return runProductionRequest(async (request) =>
		createAuthorizedMailingList(command, await requestDependencies(request.headers)),
	);
}

export async function updateMailingList(command: UpdateMailingListCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) =>
		updateAuthorizedMailingList(command, await requestDependencies(request.headers)),
	);
}

export async function setMailingListVisibility(command: SetMailingListVisibilityCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) =>
		setAuthorizedMailingListVisibility(command, await requestDependencies(request.headers)),
	);
}

export async function deleteMailingList(id: number): Promise<void> {
	'use server';
	return runProductionRequest(async (request) => deleteAuthorizedMailingList(id, await requestDependencies(request.headers)));
}
