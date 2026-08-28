import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { handleListmonkBounces } from './production-upstream/bounces';
import { handleListmonkCampaigns } from './production-upstream/campaigns';
import { handleFixtureControl } from './production-upstream/control';
import { acceptListmonkRequest, requestJson, sendJson } from './production-upstream/http';
import { handleListmonkMailingLists } from './production-upstream/lists';
import { handleListmonkSettings } from './production-upstream/settings';
import { handleShlink } from './production-upstream/shlink';
import { fixtureState } from './production-upstream/state';
import { handleListmonkSubscribers } from './production-upstream/subscribers';
import { handleListmonkTemplates } from './production-upstream/templates';
import { handleUmami } from './production-upstream/umami';

const port = 43124;

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
	const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
	if (await handleFixtureControl(request, response, url)) return;
	if (url.pathname.startsWith('/rest/v3/')) return handleShlink(request, response, url);
	if (url.pathname.startsWith('/api/templates')) return handleListmonkTemplates(request, response, url);
	if (url.pathname === '/api/settings' || url.pathname === '/api/settings/smtp/test' || url.pathname === '/api/logs') return handleListmonkSettings(request, response, url);
	if (url.pathname === '/api/lists' || url.pathname.startsWith('/api/lists/')) return handleListmonkMailingLists(request, response, url);
	if (url.pathname === '/api/config' || url.pathname === '/api/campaigns' || url.pathname.startsWith('/api/campaigns/')) return handleListmonkCampaigns(request, response, url);
	if (url.pathname === '/api/bounces') return handleListmonkBounces(request, response, url);
	if (url.pathname === '/api/subscribers' || url.pathname.startsWith('/api/subscribers/')) return handleListmonkSubscribers(request, response, url);
	if (url.pathname === '/api/tx' && request.method === 'POST') {
		if (!acceptListmonkRequest(request, response)) return;
		fixtureState.transactionalMessages.push(await requestJson(request));
		sendJson(response, { data: true });
		return;
	}
	await handleUmami(request, response, url);
}

const server = createServer((request, response) => {
	void handle(request, response).catch((error: unknown) => {
		console.error('[production-upstream] Fixture request failed', error);
		if (!response.headersSent) sendJson(response, { error: 'Fixture failure.' }, 500);
		else response.destroy();
	});
});
server.listen(port, '127.0.0.1');

function close(): void {
	server.close(() => process.exit(0));
}

process.on('SIGINT', close);
process.on('SIGTERM', close);
