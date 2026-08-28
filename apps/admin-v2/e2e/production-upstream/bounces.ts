import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson, providerBounce, acceptListmonkRequest } from './http';
import { fixtureState } from './state';
import { positiveUniqueIds } from './subscribers';

export async function handleListmonkBounces(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
	if (!acceptListmonkRequest(request, response)) return;

	if (url.pathname === '/api/bounces' && request.method === 'GET') {
		const page = Number(url.searchParams.get('page') ?? '1');
		const perPage = Number(url.searchParams.get('per_page') ?? '20');
		if (
			!Number.isSafeInteger(page) ||
			page < 1 ||
			!Number.isSafeInteger(perPage) ||
			perPage !== 50 ||
			url.searchParams.get('order_by') !== 'created_at' ||
			url.searchParams.get('order') !== 'desc'
		) {
			sendJson(response, { message: 'Invalid fixture bounce catalog bounds.' }, 400);
			return;
		}
		const ordered = [...fixtureState.bounces].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
		const offset = (page - 1) * perPage;
		if (page > 1 && offset >= ordered.length) {
			// Listmonk derives these metadata fields from the first returned row,
			// so an empty out-of-range page is the special all-zero envelope.
			sendJson(response, {
				data: {
					results: [],
					query: '',
					search: '',
					total: 0,
					per_page: 0,
					page: 0,
				},
			});
			return;
		}
		sendJson(response, {
			data: {
				results: ordered.slice(offset, offset + perPage).map(providerBounce),
				query: '',
				search: '',
				total: ordered.length,
				per_page: perPage,
				page,
			},
		});
		return;
	}

	if (url.pathname === '/api/bounces' && request.method === 'DELETE') {
		if (url.searchParams.get('all') === 'true') {
			fixtureState.bounces = [];
			sendJson(response, { data: true });
			return;
		}
		const ids = url.searchParams.getAll('id').map(Number);
		if (!positiveUniqueIds(ids) || ids.length > 100) {
			sendJson(response, { message: 'Invalid fixture bounce IDs.' }, 400);
			return;
		}
		fixtureState.bounces = fixtureState.bounces.filter((bounce) => !ids.includes(bounce.id));
		sendJson(response, { data: true });
		return;
	}

	sendJson(response, { message: 'Unknown fixture Listmonk bounce endpoint.' }, 404);
}
