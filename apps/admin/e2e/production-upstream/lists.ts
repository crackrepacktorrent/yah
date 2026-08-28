import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson, requestJson, providerMailingList, nextMailingListTimestamp, mailingListBodyIsValid, acceptListmonkRequest } from './http';
import { fixtureState } from './state';
import type { FixtureMailingList } from './state';

export async function handleListmonkMailingLists(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
	if (!acceptListmonkRequest(request, response)) return;

	if (url.pathname === '/api/lists' && request.method === 'GET') {
		const page = Number(url.searchParams.get('page') ?? '1');
		const perPage = Number(url.searchParams.get('per_page') ?? '20');
		const offset = Math.max(0, (page - 1) * perPage);
		sendJson(response, {
			data: {
				results: fixtureState.mailingLists.slice(offset, offset + perPage).map(providerMailingList),
				query: '',
				total: fixtureState.mailingLists.length,
				per_page: perPage,
				page,
			},
		});
		return;
	}
	if (url.pathname === '/api/lists' && request.method === 'POST') {
		const body = await requestJson(request);
		if (!mailingListBodyIsValid(body)) {
			sendJson(response, { message: 'Invalid fixture mailing-list settings.' }, 422);
			return;
		}
		const now = nextMailingListTimestamp();
		const id = fixtureState.nextMailingListId;
		fixtureState.nextMailingListId += 1;
		const created: FixtureMailingList = {
			id,
			uuid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
			name: body['name'],
			type: body['type'],
			optin: body['optin'],
			status: body['status'],
			description: body['description'],
			tags: body['tags'],
			subscriberCount: 0,
			subscriberStatuses: { confirmed: 0, unconfirmed: 0 },
			createdAt: now,
			updatedAt: now,
		};
		fixtureState.mailingLists.push(created);
		sendJson(response, { data: providerMailingList(created) });
		return;
	}

	const listMatch = url.pathname.match(/^\/api\/lists\/(\d+)$/);
	if (listMatch) {
		const id = Number(listMatch[1]);
		const index = fixtureState.mailingLists.findIndex((list) => list.id === id);
		if (index < 0) {
			// Listmonk v6 turns its missing-record database error into a 400 on
			// numeric detail routes rather than a conventional 404.
			sendJson(response, { message: 'Unknown fixture mailing list.' }, 400);
			return;
		}
		const list = fixtureState.mailingLists[index] as FixtureMailingList;
		if (request.method === 'GET') {
			sendJson(response, { data: providerMailingList(list) });
			return;
		}
		if (request.method === 'PUT') {
			const body = await requestJson(request);
			if (!mailingListBodyIsValid(body)) {
				sendJson(response, { message: 'Invalid fixture mailing-list settings.' }, 422);
				return;
			}
			list.name = body['name'];
			list.type = body['type'];
			list.optin = body['optin'];
			list.status = body['status'];
			// Listmonk v6's update query preserves an existing description when
			// the submitted value is empty.
			if (body['description'] !== '') list.description = body['description'];
			list.tags = body['tags'];
			list.updatedAt = nextMailingListTimestamp();
			sendJson(response, { data: providerMailingList(list) });
			return;
		}
		if (request.method === 'DELETE') {
			fixtureState.mailingLists.splice(index, 1);
			for (const subscriber of fixtureState.subscribers) {
				subscriber.memberships = subscriber.memberships.filter((membership) => membership.listId !== id);
			}
			sendJson(response, { data: true });
			return;
		}
	}

	sendJson(response, { message: 'Unknown fixture Listmonk endpoint.' }, 404);
}
