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
import { surfaceError } from '~/platform/errors';
import { getServerRequest } from '~/platform/request';
import { requireProductionRuntime } from '~/platform/runtime.server';

async function dependencies() {
	const [{ enforcePermissions }, { productionMailingListManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-mailing-list-manager.server'),
	]);
	return { enforcePermissions, manager: productionMailingListManager };
}

export const listMailingLists = query(async (): Promise<MailingList[]> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await listAuthorizedMailingLists(request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'mailing-lists');

export const getMailingList = query(async (id: number): Promise<MailingList> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await readAuthorizedMailingList(id, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'mailing-list');

export const requireMailingListCapability = query(async (capability: MailingListCapability): Promise<true> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await requireAuthorizedMailingListCapability(capability, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'mailing-list-capability');

export const getSubscriptionSharingConfig = query(async (): Promise<{ publicSiteUrl: string }> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await requireAuthorizedMailingListCapability('view', request.headers, await dependencies());
		const { productionConfig } = await import('~/platform/config/production-env.server');
		return { publicSiteUrl: productionConfig.PUBLIC_SITE_URL };
	} catch (error) {
		surfaceError(error);
	}
}, 'subscription-sharing-config');

export async function createMailingList(command: CreateMailingListCommand): Promise<{ id: number }> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await createAuthorizedMailingList(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function updateMailingList(command: UpdateMailingListCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await updateAuthorizedMailingList(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function setMailingListVisibility(command: SetMailingListVisibilityCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await setAuthorizedMailingListVisibility(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function deleteMailingList(id: number): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await deleteAuthorizedMailingList(id, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}
