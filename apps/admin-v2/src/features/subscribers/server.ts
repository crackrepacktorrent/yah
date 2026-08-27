import { query } from '@solidjs/router';
import type {
	BlocklistSubscribersCommand,
	CreateSubscriberCommand,
	DeleteSubscribersCommand,
	ListSubscribersQuery,
	RequestSubscriberOptInCommand,
	SubscriberActivity,
	SubscriberCapability,
	SubscriberMembershipState,
	SubscriberPage,
	SubscriberProfile,
	UpdateSubscriberMembershipsCommand,
	UpdateSubscriberProfileCommand,
} from './contracts';
import {
	blocklistAuthorizedSubscribers,
	createAuthorizedSubscriber,
	deleteAuthorizedSubscribers,
	listAuthorizedSubscribers,
	readAuthorizedSubscriber,
	readAuthorizedSubscriberActivity,
	readAuthorizedSubscriberMemberships,
	requestAuthorizedSubscriberOptIn,
	requireAuthorizedSubscriberCapability,
	updateAuthorizedSubscriberMemberships,
	updateAuthorizedSubscriberProfile,
} from './service';
import { surfaceError } from '~/platform/errors';
import { getServerRequest } from '~/platform/request';
import { requireProductionRuntime } from '~/platform/runtime.server';

async function dependencies() {
	const [{ enforcePermissions }, { productionSubscriberManager }, { productionMailingListManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-subscriber-manager.server'),
		import('~/integrations/listmonk/production-mailing-list-manager.server'),
	]);
	return {
		enforcePermissions,
		manager: productionSubscriberManager,
		mailingLists: productionMailingListManager,
	};
}

export const listSubscribers = query(async (input: ListSubscribersQuery): Promise<SubscriberPage> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await listAuthorizedSubscribers(input, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'subscribers');

export const getSubscriber = query(async (id: number): Promise<SubscriberProfile> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await readAuthorizedSubscriber(id, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'subscriber');

export const getSubscriberMemberships = query(async (id: number): Promise<SubscriberMembershipState> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await readAuthorizedSubscriberMemberships(id, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'subscriber-memberships');

export const getSubscriberActivity = query(async (id: number): Promise<SubscriberActivity> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await readAuthorizedSubscriberActivity(id, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'subscriber-activity');

export const requireSubscriberCapability = query(async (capability: SubscriberCapability): Promise<true> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await requireAuthorizedSubscriberCapability(capability, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'subscriber-capability');

export async function createSubscriber(command: CreateSubscriberCommand): Promise<{ id: number }> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await createAuthorizedSubscriber(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function updateSubscriberProfile(command: UpdateSubscriberProfileCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await updateAuthorizedSubscriberProfile(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function updateSubscriberMemberships(command: UpdateSubscriberMembershipsCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await updateAuthorizedSubscriberMemberships(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function deleteSubscribers(command: DeleteSubscribersCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await deleteAuthorizedSubscribers(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function blocklistSubscribers(command: BlocklistSubscribersCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await blocklistAuthorizedSubscribers(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function requestSubscriberOptIn(command: RequestSubscriberOptInCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await requestAuthorizedSubscriberOptIn(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}
