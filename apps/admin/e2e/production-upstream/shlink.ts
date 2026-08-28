import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson, sendProblem, hasDateTimeOffset, visitSummary, shlinkShortlink, pagination, requestJson } from './http';
import { fixtureState, shlinkApiKey } from './state';
import type { FixtureShortlink } from './state';

export async function handleShlink(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
	if (request.headers['x-api-key'] !== shlinkApiKey || !request.headers.accept?.includes('application/json')) {
		sendJson(
			response,
			{
				title: 'Unauthorized',
				detail: 'Invalid fixture API key.',
				status: 401,
				type: 'unauthorized',
			},
			401,
		);
		return;
	}
	if (fixtureState.failNextShlinkRequest) {
		fixtureState.failNextShlinkRequest = false;
		response.writeHead(502, { 'content-type': 'text/plain' });
		response.end('fixture confidential shlink diagnostic');
		return;
	}

	const restPath = url.pathname.slice('/rest/v3'.length);
	if (restPath === '/short-urls' && request.method === 'GET') {
		const itemsPerPage = Number(url.searchParams.get('itemsPerPage') ?? '10');
		const sorted = [...fixtureState.shortlinks].sort((left, right) => right.dateCreated.localeCompare(left.dateCreated));
		sendJson(response, {
			shortUrls: {
				data: sorted.slice(0, itemsPerPage).map(shlinkShortlink),
				pagination: pagination(sorted.length, itemsPerPage),
			},
		});
		return;
	}
	if (restPath === '/short-urls' && request.method === 'POST') {
		const body = await requestJson(request);
		const shortCode = typeof body['customSlug'] === 'string' ? body['customSlug'] : `generated-${fixtureState.shortlinks.length + 1}`;
		if (fixtureState.shortlinks.some((link) => link.shortCode === shortCode)) {
			sendProblem(
				response,
				{
					title: 'Invalid custom slug',
					detail: 'The short code already exists.',
					status: 400,
					type: 'https://shlink.io/api/error/non-unique-slug',
				},
				400,
			);
			return;
		}
		if (typeof body['validUntil'] === 'string' && !hasDateTimeOffset(body['validUntil'])) {
			sendProblem(
				response,
				{
					title: 'Invalid data',
					detail: 'validUntil must include an offset.',
					status: 400,
					type: 'https://shlink.io/api/error/invalid-data',
				},
				400,
			);
			return;
		}
		const created: FixtureShortlink = {
			shortCode,
			longUrl: String(body['longUrl']),
			title: typeof body['title'] === 'string' ? body['title'] : null,
			tags: Array.isArray(body['tags']) ? body['tags'].map(String) : [],
			crawlable: body['crawlable'] === true,
			forwardQuery: body['forwardQuery'] === true,
			maxVisits: typeof body['maxVisits'] === 'number' ? body['maxVisits'] : null,
			validUntil: typeof body['validUntil'] === 'string' ? new Date(body['validUntil']).toISOString() : null,
			dateCreated: new Date().toISOString(),
			visits: [],
		};
		fixtureState.shortlinks.unshift(created);
		sendJson(response, shlinkShortlink(created));
		return;
	}
	if (restPath === '/visits' && request.method === 'GET') {
		const summaries = fixtureState.shortlinks.map(visitSummary);
		const nonOrphanVisits = summaries.reduce(
			(total, item) => ({
				total: total.total + item.total,
				nonBots: total.nonBots + item.nonBots,
				bots: total.bots + item.bots,
			}),
			{ total: 0, nonBots: 0, bots: 0 },
		);
		sendJson(response, {
			visits: {
				nonOrphanVisits,
				orphanVisits: { total: 0, nonBots: 0, bots: 0 },
			},
		});
		return;
	}

	const visitsMatch = restPath.match(/^\/short-urls\/([^/]+)\/visits$/);
	if (visitsMatch) {
		const shortCode = decodeURIComponent(visitsMatch[1] ?? '');
		const link = fixtureState.shortlinks.find((candidate) => candidate.shortCode === shortCode);
		if (!link) {
			sendJson(
				response,
				{
					title: 'Not found',
					detail: 'Unknown short code.',
					status: 404,
					type: 'not-found',
				},
				404,
			);
			return;
		}
		if (request.method === 'GET') {
			const excludeBots = url.searchParams.get('excludeBots') === 'true';
			const itemsPerPage = Number(url.searchParams.get('itemsPerPage') ?? '10');
			const visits = link.visits.filter((visit) => !excludeBots || !visit.potentialBot);
			sendJson(response, {
				visits: {
					data: visits.slice(0, itemsPerPage).map((visit) => ({
						...visit,
						visitedUrl: null,
						redirectUrl: null,
					})),
					pagination: pagination(visits.length, itemsPerPage),
				},
			});
			return;
		}
		if (request.method === 'DELETE') {
			const deletedVisits = link.visits.length;
			link.visits = [];
			sendJson(response, { deletedVisits });
			return;
		}
	}

	const shortlinkMatch = restPath.match(/^\/short-urls\/([^/]+)$/);
	if (shortlinkMatch) {
		const shortCode = decodeURIComponent(shortlinkMatch[1] ?? '');
		const index = fixtureState.shortlinks.findIndex((candidate) => candidate.shortCode === shortCode);
		if (index < 0) {
			sendJson(
				response,
				{
					title: 'Not found',
					detail: 'Unknown short code.',
					status: 404,
					type: 'not-found',
				},
				404,
			);
			return;
		}
		const link = fixtureState.shortlinks[index] as FixtureShortlink;
		if (request.method === 'GET') {
			sendJson(response, shlinkShortlink(link));
			return;
		}
		if (request.method === 'PATCH') {
			const body = await requestJson(request);
			if (typeof body['validUntil'] === 'string' && !hasDateTimeOffset(body['validUntil'])) {
				sendProblem(
					response,
					{
						title: 'Invalid data',
						detail: 'validUntil must include an offset.',
						status: 400,
						type: 'https://shlink.io/api/error/invalid-data',
					},
					400,
				);
				return;
			}
			link.longUrl = String(body['longUrl']);
			link.title = typeof body['title'] === 'string' ? body['title'] : null;
			link.tags = Array.isArray(body['tags']) ? body['tags'].map(String) : [];
			link.crawlable = body['crawlable'] === true;
			link.forwardQuery = body['forwardQuery'] === true;
			link.maxVisits = typeof body['maxVisits'] === 'number' ? body['maxVisits'] : null;
			link.validUntil = typeof body['validUntil'] === 'string' ? new Date(body['validUntil']).toISOString() : null;
			sendJson(response, shlinkShortlink(link));
			return;
		}
		if (request.method === 'DELETE') {
			fixtureState.shortlinks.splice(index, 1);
			response.writeHead(204);
			response.end();
			return;
		}
	}

	sendJson(
		response,
		{
			title: 'Not found',
			detail: 'Unknown fixture endpoint.',
			status: 404,
			type: 'not-found',
		},
		404,
	);
}
