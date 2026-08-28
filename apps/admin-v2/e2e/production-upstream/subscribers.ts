import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson, requestJson, providerSubscriber, providerSubscriberActivity, providerBounce, nextSubscriberTimestamp, nextOptInTimestamp, acceptListmonkRequest } from './http';
import { emptySubscriberActivity, fixtureMembership, fixtureState } from './state';
import type { FixtureSubscriptionStatus, FixtureSubscriber } from './state';

function isSubscriberStatus(value: unknown): value is FixtureSubscriber['status'] {
	return value === 'enabled' || value === 'disabled' || value === 'blocklisted';
}

function isSubscriptionStatus(value: unknown): value is FixtureSubscriptionStatus {
	return value === 'unconfirmed' || value === 'confirmed' || value === 'unsubscribed';
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function positiveUniqueIds(value: unknown): value is number[] {
	return Array.isArray(value) && value.length > 0 && value.every((id) => Number.isSafeInteger(id) && Number(id) > 0) && new Set(value).size === value.length;
}

function subscriberBodyIsValid(body: Record<string, unknown>): boolean {
	return (
		typeof body['email'] === 'string' &&
		typeof body['name'] === 'string' &&
		isSubscriberStatus(body['status']) &&
		Array.isArray(body['lists']) &&
		body['lists'].length <= 1_000 &&
		body['lists'].every((id) => Number.isSafeInteger(id) && Number(id) > 0) &&
		new Set(body['lists']).size === body['lists'].length &&
		isJsonObject(body['attribs']) &&
		typeof body['preconfirm_subscriptions'] === 'boolean'
	);
}

function requestedSubscriberLists(body: Record<string, unknown>): number[] {
	return body['lists'] as number[];
}

function allSubscriberListsExist(ids: readonly number[]): boolean {
	return ids.every((id) => fixtureState.mailingLists.some((list) => list.id === id));
}

function applyFullSubscriberUpdate(subscriber: FixtureSubscriber, body: Record<string, unknown>): void {
	const now = nextSubscriberTimestamp();
	const listIds = requestedSubscriberLists(body);
	const currentById = new Map(subscriber.memberships.map((membership) => [membership.listId, membership]));
	const preconfirmed = body['preconfirm_subscriptions'] === true;
	subscriber.email = body['email'] as string;
	// Listmonk v6 preserves the current name when an empty value is submitted.
	if (body['name'] !== '') subscriber.name = body['name'] as string;
	subscriber.status = body['status'] as FixtureSubscriber['status'];
	subscriber.attribs = body['attribs'] as Record<string, unknown>;
	subscriber.memberships = listIds.map(
		(listId) =>
			currentById.get(listId) ??
			fixtureMembership(listId, preconfirmed ? 'confirmed' : 'unconfirmed', {
				createdAt: now,
				updatedAt: now,
			}),
	);
	if (subscriber.status === 'blocklisted') {
		for (const membership of subscriber.memberships) {
			membership.status = 'unsubscribed';
			membership.updatedAt = now;
		}
	}
	subscriber.updatedAt = now;
}

export async function handleListmonkSubscribers(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
	if (!acceptListmonkRequest(request, response)) return;

	if (url.pathname === '/api/subscribers' && request.method === 'GET') {
		const page = Number(url.searchParams.get('page') ?? '1');
		const perPage = Number(url.searchParams.get('per_page') ?? '20');
		const search = url.searchParams.get('search') ?? '';
		const query = url.searchParams.get('query') ?? '';
		if (
			!Number.isSafeInteger(page) ||
			page < 1 ||
			!Number.isSafeInteger(perPage) ||
			perPage < 1 ||
			perPage > 50 ||
			search.length > 1_000 ||
			query !== '' ||
			url.searchParams.has('order_by') ||
			url.searchParams.has('order')
		) {
			sendJson(response, { message: 'Invalid fixture subscriber catalog bounds.' }, 400);
			return;
		}
		let matcher: RegExp | null = null;
		try {
			matcher = search === '' ? null : new RegExp(search, 'i');
		} catch {
			sendJson(response, { message: 'Invalid fixture subscriber search expression.' }, 400);
			return;
		}
		const filtered = [...fixtureState.subscribers]
			.filter((subscriber) => matcher === null || matcher.test(subscriber.email) || matcher.test(subscriber.name))
			.sort((left, right) => right.id - left.id);
		const offset = (page - 1) * perPage;
		sendJson(response, {
			data: {
				results: filtered.slice(offset, offset + perPage).map(providerSubscriber),
				query,
				search,
				total: filtered.length,
				per_page: perPage,
				page,
			},
		});
		return;
	}

	if (url.pathname === '/api/subscribers' && request.method === 'POST') {
		const body = await requestJson(request);
		if (!subscriberBodyIsValid(body) || !allSubscriberListsExist(requestedSubscriberLists(body))) {
			sendJson(response, { message: 'Invalid fixture subscriber settings.' }, 422);
			return;
		}
		const email = body['email'] as string;
		if (fixtureState.subscribers.some((subscriber) => subscriber.email.toLowerCase() === email.toLowerCase())) {
			sendJson(response, { message: 'A fixture subscriber with this email already exists.' }, 409);
			return;
		}
		const now = nextSubscriberTimestamp();
		const id = fixtureState.nextSubscriberId++;
		const status = body['status'] as FixtureSubscriber['status'];
		const membershipStatus: FixtureSubscriptionStatus = status === 'blocklisted' ? 'unsubscribed' : body['preconfirm_subscriptions'] === true ? 'confirmed' : 'unconfirmed';
		const created: FixtureSubscriber = {
			id,
			uuid: `10000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
			email,
			name: body['name'] as string,
			status,
			attribs: body['attribs'] as Record<string, unknown>,
			memberships: requestedSubscriberLists(body).map((listId) =>
				fixtureMembership(listId, membershipStatus, {
					createdAt: now,
					updatedAt: now,
				}),
			),
			activity: emptySubscriberActivity(),
			createdAt: now,
			updatedAt: now,
		};
		fixtureState.subscribers.push(created);
		if (
			body['preconfirm_subscriptions'] !== true &&
			requestedSubscriberLists(body).some((listId) => fixtureState.mailingLists.find((list) => list.id === listId)?.optin === 'double')
		) {
			// Exact Listmonk v6 creation semantics: selected double-opt-in lists can
			// synchronously trigger a confirmation request. The v2 adapter must avoid
			// this path by posting the identity with no memberships.
			fixtureState.optInRequests.push({
				subscriberId: created.id,
				requestedAt: nextOptInTimestamp(),
			});
		}
		sendJson(response, { data: providerSubscriber(created) });
		return;
	}

	if (url.pathname === '/api/subscribers' && request.method === 'DELETE') {
		const ids = url.searchParams.getAll('id').map(Number);
		if (!positiveUniqueIds(ids) || ids.length > 100) {
			sendJson(response, { message: 'Invalid fixture subscriber IDs.' }, 400);
			return;
		}
		fixtureState.subscribers = fixtureState.subscribers.filter((subscriber) => !ids.includes(subscriber.id));
		fixtureState.bounces = fixtureState.bounces.filter((bounce) => !ids.includes(bounce.subscriberId));
		sendJson(response, { data: true });
		return;
	}

	if (url.pathname === '/api/subscribers/lists' && request.method === 'PUT') {
		const body = await requestJson(request);
		const ids = body['ids'];
		const targetListIds = body['target_list_ids'];
		const action = body['action'];
		const requestedStatus = body['status'];
		if (
			!positiveUniqueIds(ids) ||
			ids.length > 100 ||
			!positiveUniqueIds(targetListIds) ||
			targetListIds.length > 1_000 ||
			(action !== 'add' && action !== 'unsubscribe') ||
			(requestedStatus !== undefined && !isSubscriptionStatus(requestedStatus)) ||
			!allSubscriberListsExist(targetListIds)
		) {
			sendJson(response, { message: 'Invalid fixture subscriber membership update.' }, 422);
			return;
		}
		let mutationTimestamp: string | undefined;
		const timestamp = () => (mutationTimestamp ??= nextSubscriberTimestamp());
		for (const subscriber of fixtureState.subscribers.filter(({ id }) => ids.includes(id))) {
			for (const listId of targetListIds) {
				const membership = subscriber.memberships.find((candidate) => candidate.listId === listId);
				if (action === 'unsubscribe') {
					if (membership) {
						membership.status = 'unsubscribed';
						membership.updatedAt = timestamp();
					}
					continue;
				}
				if (!membership) {
					subscriber.memberships.push(
						fixtureMembership(listId, requestedStatus ?? 'unconfirmed', {
							createdAt: timestamp(),
							updatedAt: timestamp(),
						}),
					);
				} else if (requestedStatus !== undefined) {
					membership.status = requestedStatus;
					membership.updatedAt = timestamp();
				}
			}
		}
		// Listmonk mutates subscriber_lists.updated_at, not subscribers.updated_at.
		sendJson(response, { data: true });
		return;
	}

	if (url.pathname === '/api/subscribers/blocklist' && request.method === 'PUT') {
		const body = await requestJson(request);
		const ids = body['ids'];
		if (!positiveUniqueIds(ids) || ids.length > 100) {
			sendJson(response, { message: 'Invalid fixture subscriber IDs.' }, 422);
			return;
		}
		const now = nextSubscriberTimestamp();
		for (const subscriber of fixtureState.subscribers.filter(({ id }) => ids.includes(id))) {
			subscriber.status = 'blocklisted';
			subscriber.updatedAt = now;
			for (const membership of subscriber.memberships) {
				membership.status = 'unsubscribed';
				membership.updatedAt = now;
			}
		}
		sendJson(response, { data: true });
		return;
	}

	const bounceMatch = url.pathname.match(/^\/api\/subscribers\/(\d+)\/bounces$/);
	if (bounceMatch) {
		const subscriberId = Number(bounceMatch[1]);
		if (!fixtureState.subscribers.some(({ id }) => id === subscriberId)) {
			sendJson(response, { message: 'Unknown fixture subscriber.' }, 400);
			return;
		}
		if (request.method === 'GET') {
			sendJson(response, {
				data: fixtureState.bounces.filter((bounce) => bounce.subscriberId === subscriberId).map(providerBounce),
			});
			return;
		}
		if (request.method === 'DELETE') {
			fixtureState.bounces = fixtureState.bounces.filter((bounce) => bounce.subscriberId !== subscriberId);
			sendJson(response, { data: true });
			return;
		}
	}

	const activityMatch = url.pathname.match(/^\/api\/subscribers\/(\d+)\/activity$/);
	if (activityMatch && request.method === 'GET') {
		const subscriber = fixtureState.subscribers.find(({ id }) => id === Number(activityMatch[1]));
		if (!subscriber) {
			sendJson(response, { message: 'Unknown fixture subscriber.' }, 400);
			return;
		}
		sendJson(response, {
			data: providerSubscriberActivity(subscriber.activity),
		});
		return;
	}

	const optInMatch = url.pathname.match(/^\/api\/subscribers\/(\d+)\/optin$/);
	if (optInMatch && request.method === 'POST') {
		const subscriber = fixtureState.subscribers.find(({ id }) => id === Number(optInMatch[1]));
		if (!subscriber) {
			sendJson(response, { message: 'Unknown fixture subscriber.' }, 400);
			return;
		}
		const eligible =
			subscriber.status === 'enabled' &&
			subscriber.memberships.some((membership) => {
				const list = fixtureState.mailingLists.find(({ id }) => id === membership.listId);
				return membership.status === 'unconfirmed' && list?.optin === 'double';
			});
		if (!eligible) {
			sendJson(
				response,
				{
					message: 'Fixture subscriber has no pending double opt-in membership.',
				},
				409,
			);
			return;
		}
		// The real provider queues mail here. The fixture records intent only and
		// never opens an SMTP or external network connection.
		fixtureState.optInRequests.push({
			subscriberId: subscriber.id,
			requestedAt: nextOptInTimestamp(),
		});
		sendJson(response, { data: true });
		return;
	}

	const subscriberMatch = url.pathname.match(/^\/api\/subscribers\/(\d+)$/);
	if (subscriberMatch) {
		const subscriber = fixtureState.subscribers.find(({ id }) => id === Number(subscriberMatch[1]));
		if (!subscriber) {
			// Listmonk v6 returns 400 for a missing valid numeric subscriber ID.
			sendJson(response, { message: 'Unknown fixture subscriber.' }, 400);
			return;
		}
		if (request.method === 'GET') {
			sendJson(response, { data: providerSubscriber(subscriber) });
			return;
		}
		if (request.method === 'PUT') {
			const body = await requestJson(request);
			if (!subscriberBodyIsValid(body) || !allSubscriberListsExist(requestedSubscriberLists(body))) {
				sendJson(response, { message: 'Invalid fixture subscriber settings.' }, 422);
				return;
			}
			const email = body['email'] as string;
			if (fixtureState.subscribers.some((candidate) => candidate.id !== subscriber.id && candidate.email.toLowerCase() === email.toLowerCase())) {
				sendJson(response, { message: 'A fixture subscriber with this email already exists.' }, 409);
				return;
			}
			applyFullSubscriberUpdate(subscriber, body);
			sendJson(response, { data: providerSubscriber(subscriber) });
			return;
		}
	}

	sendJson(response, { message: 'Unknown fixture Listmonk subscriber endpoint.' }, 404);
}
