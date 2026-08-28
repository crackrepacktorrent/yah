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
import { runProductionRequest } from '~/platform/production-request.server';

async function requestDependencies(headers: Headers) {
	const [{ createAuthorizationContext }, { productionSubscriberManager }, { productionMailingListManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-subscriber-manager.server'),
		import('~/integrations/listmonk/production-mailing-list-manager.server'),
	]);
	return {
		authorization: createAuthorizationContext(headers),
		manager: productionSubscriberManager,
		mailingLists: productionMailingListManager,
	};
}

export const listSubscribers = query(async (input: ListSubscribersQuery): Promise<SubscriberPage> => {
	'use server';
	return runProductionRequest(async (request) => listAuthorizedSubscribers(input, await requestDependencies(request.headers)));
}, 'subscribers');

export const getSubscriber = query(async (id: number): Promise<SubscriberProfile> => {
	'use server';
	return runProductionRequest(async (request) => readAuthorizedSubscriber(id, await requestDependencies(request.headers)));
}, 'subscriber');

export const getSubscriberMemberships = query(async (id: number): Promise<SubscriberMembershipState> => {
	'use server';
	return runProductionRequest(async (request) =>
		readAuthorizedSubscriberMemberships(id, await requestDependencies(request.headers)),
	);
}, 'subscriber-memberships');

export const getSubscriberActivity = query(async (id: number): Promise<SubscriberActivity> => {
	'use server';
	return runProductionRequest(async (request) =>
		readAuthorizedSubscriberActivity(id, await requestDependencies(request.headers)),
	);
}, 'subscriber-activity');

export const requireSubscriberCapability = query(async (capability: SubscriberCapability): Promise<true> => {
	'use server';
	return runProductionRequest(async (request) =>
		requireAuthorizedSubscriberCapability(capability, await requestDependencies(request.headers)),
	);
}, 'subscriber-capability');

export async function createSubscriber(command: CreateSubscriberCommand): Promise<{ id: number }> {
	'use server';
	return runProductionRequest(async (request) => createAuthorizedSubscriber(command, await requestDependencies(request.headers)));
}

export async function updateSubscriberProfile(command: UpdateSubscriberProfileCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) =>
		updateAuthorizedSubscriberProfile(command, await requestDependencies(request.headers)),
	);
}

export async function updateSubscriberMemberships(command: UpdateSubscriberMembershipsCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) =>
		updateAuthorizedSubscriberMemberships(command, await requestDependencies(request.headers)),
	);
}

export async function deleteSubscribers(command: DeleteSubscribersCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) =>
		deleteAuthorizedSubscribers(command, await requestDependencies(request.headers)),
	);
}

export async function blocklistSubscribers(command: BlocklistSubscribersCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) =>
		blocklistAuthorizedSubscribers(command, await requestDependencies(request.headers)),
	);
}

export async function requestSubscriberOptIn(command: RequestSubscriberOptInCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) =>
		requestAuthorizedSubscriberOptIn(command, await requestDependencies(request.headers)),
	);
}
