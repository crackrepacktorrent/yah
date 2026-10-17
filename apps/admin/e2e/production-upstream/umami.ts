import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson, analyticsPayload, requestJson } from './http';
import { farFutureToken } from './state';
import { fixtureState } from './state';

export async function handleUmami(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
	if (url.pathname === '/api/auth/login' && request.method === 'POST') {
		sendJson(response, { token: farFutureToken });
		return;
	}
	const isBreakdown = url.pathname === '/api/reports/breakdown' && request.method === 'POST';
	if (!url.pathname.startsWith('/api/websites/website%2Fid/') && !isBreakdown) {
		sendJson(response, { error: 'Not found.' }, 404);
		return;
	}
	if (request.headers.authorization !== `Bearer ${farFutureToken}`) {
		sendJson(response, { error: 'Unauthorized.' }, 401);
		return;
	}
	if (fixtureState.failNextUmamiRequest) {
		fixtureState.failNextUmamiRequest = false;
		response.writeHead(502, { 'content-type': 'text/plain' });
		response.end('fixture confidential diagnostic');
		return;
	}
	if (fixtureState.delayNextUmamiRequest) {
		fixtureState.delayNextUmamiRequest = false;
		await new Promise((resolve) => setTimeout(resolve, 300));
	}
	if (isBreakdown) {
		const body = await requestJson(request);
		const parameters = body['parameters'] as Record<string, unknown>;
		const filters = body['filters'] as Record<string, unknown>;
		if (body['type'] !== 'breakdown' || body['websiteId'] !== 'website/id' || filters?.['country'] !== 'eq.US' || JSON.stringify(parameters?.['fields']) !== '["city","region"]') {
			sendJson(response, { error: 'Invalid breakdown request.' }, 400);
			return;
		}
		url.searchParams.set('startAt', String(Date.parse(String(parameters['startDate']))));
		url.searchParams.set('endAt', String(Date.parse(String(parameters['endDate']))));
	}

	setTimeout(() => sendJson(response, analyticsPayload(url)), 40);
}
