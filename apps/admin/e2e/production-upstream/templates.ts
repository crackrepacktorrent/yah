import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson, sendHtml, requestJson, requestText, providerEmailTemplate, renderEmailTemplate, acceptListmonkRequest } from './http';
import { fixtureState } from './state';
import type { FixtureEmailTemplate } from './state';

export async function handleListmonkTemplates(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
	if (!acceptListmonkRequest(request, response)) return;

	if (url.pathname === '/api/templates' && request.method === 'GET') {
		const withoutBody = url.searchParams.get('no_body') === 'true';
		sendJson(response, {
			data: fixtureState.emailTemplates.map((template) => providerEmailTemplate(template, !withoutBody)),
		});
		return;
	}
	if (url.pathname === '/api/templates' && request.method === 'POST') {
		const body = await requestJson(request);
		const kind = body['type'];
		if (kind !== 'tx' && kind !== 'campaign') {
			sendJson(response, { message: 'Unsupported fixture template type.' }, 422);
			return;
		}
		const now = new Date().toISOString();
		const created: FixtureEmailTemplate = {
			id: Math.max(0, ...fixtureState.emailTemplates.map(({ id }) => id)) + 1,
			name: String(body['name']),
			type: kind,
			subject: typeof body['subject'] === 'string' ? body['subject'] : '',
			body: String(body['body']),
			bodySource: null,
			isDefault: false,
			createdAt: now,
			updatedAt: now,
		};
		fixtureState.emailTemplates.push(created);
		sendJson(response, { data: providerEmailTemplate(created) });
		return;
	}
	if (url.pathname === '/api/templates/preview' && request.method === 'POST') {
		const form = new URLSearchParams(await requestText(request));
		sendHtml(response, renderEmailTemplate(form.get('body') ?? ''));
		return;
	}

	const previewMatch = url.pathname.match(/^\/api\/templates\/(\d+)\/preview$/);
	if (previewMatch && request.method === 'GET') {
		const template = fixtureState.emailTemplates.find(({ id }) => id === Number(previewMatch[1]));
		if (!template) {
			sendJson(response, { message: 'Unknown fixture template.' }, 400);
			return;
		}
		sendHtml(response, renderEmailTemplate(template.body));
		return;
	}

	const defaultMatch = url.pathname.match(/^\/api\/templates\/(\d+)\/default$/);
	if (defaultMatch && request.method === 'PUT') {
		const template = fixtureState.emailTemplates.find(({ id }) => id === Number(defaultMatch[1]));
		if (!template) {
			// Listmonk v6 does not check the affected row count: this narrow race
			// clears the prior default and still returns the whole template array.
			for (const candidate of fixtureState.emailTemplates) candidate.isDefault = false;
			sendJson(response, {
				data: fixtureState.emailTemplates.map((candidate) => providerEmailTemplate(candidate)),
			});
			return;
		}
		if (template.type !== 'campaign') {
			sendJson(response, { message: 'Only campaign templates can be default.' }, 422);
			return;
		}
		for (const candidate of fixtureState.emailTemplates) candidate.isDefault = candidate.id === template.id && candidate.type === 'campaign';
		template.updatedAt = new Date().toISOString();
		sendJson(response, {
			data: fixtureState.emailTemplates.map((candidate) => providerEmailTemplate(candidate)),
		});
		return;
	}

	const templateMatch = url.pathname.match(/^\/api\/templates\/(\d+)$/);
	if (templateMatch) {
		const id = Number(templateMatch[1]);
		const index = fixtureState.emailTemplates.findIndex((template) => template.id === id);
		if (index < 0) {
			sendJson(response, { message: 'Unknown fixture template.' }, 400);
			return;
		}
		const template = fixtureState.emailTemplates[index] as FixtureEmailTemplate;
		if (request.method === 'GET') {
			sendJson(response, { data: providerEmailTemplate(template) });
			return;
		}
		if (request.method === 'PUT') {
			const body = await requestJson(request);
			template.name = String(body['name']);
			template.subject = typeof body['subject'] === 'string' ? body['subject'] : '';
			template.body = String(body['body']);
			template.updatedAt = new Date().toISOString();
			sendJson(response, { data: providerEmailTemplate(template) });
			return;
		}
		if (request.method === 'DELETE') {
			if (template.isDefault) {
				sendJson(response, { message: 'Default template cannot be deleted.' }, 409);
				return;
			}
			fixtureState.emailTemplates.splice(index, 1);
			sendJson(response, { data: true });
			return;
		}
	}

	sendJson(response, { message: 'Unknown fixture Listmonk endpoint.' }, 404);
}
