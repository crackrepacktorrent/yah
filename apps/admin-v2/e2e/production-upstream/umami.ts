import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson, analyticsPayload } from './http';
import { farFutureToken } from './state';
import { fixtureState } from './state';

export async function handleUmami(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
	if (url.pathname === '/api/auth/login' && request.method === 'POST') {
		sendJson(response, { token: farFutureToken });
		return;
	}
	if (!url.pathname.startsWith('/api/websites/website%2Fid/')) {
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

	setTimeout(() => sendJson(response, analyticsPayload(url)), 40);
}
