import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson, sendHtml, sendPlain, requestJson, providerCampaign, nextCampaignTimestamp, acceptListmonkRequest } from './http';
import { fixtureState } from './state';
import type { FixtureSubscriber, FixtureCampaign, FixtureCampaignAnalyticsRequest } from './state';

function isCampaignType(value: unknown): value is FixtureCampaign['type'] {
	return value === 'regular' || value === 'optin';
}

function isCampaignContentType(value: unknown): value is FixtureCampaign['contentType'] {
	return value === 'richtext' || value === 'html' || value === 'markdown' || value === 'plain' || value === 'visual';
}

function campaignCoreBodyIsValid(body: Record<string, unknown>): boolean {
	return (
		typeof body['name'] === 'string' &&
		body['name'].trim().length > 0 &&
		typeof body['subject'] === 'string' &&
		body['subject'].trim().length > 0 &&
		typeof body['from_email'] === 'string' &&
		Array.isArray(body['lists']) &&
		body['lists'].length > 0 &&
		body['lists'].every((id) => Number.isSafeInteger(id) && Number(id) > 0) &&
		typeof body['body'] === 'string' &&
		isCampaignContentType(body['content_type']) &&
		(body['template_id'] === null || (Number.isSafeInteger(body['template_id']) && Number(body['template_id']) > 0)) &&
		Array.isArray(body['tags']) &&
		body['tags'].every((tag) => typeof tag === 'string') &&
		(body['send_at'] === null || (typeof body['send_at'] === 'string' && Date.parse(body['send_at']) > Date.now()))
	);
}

function campaignProviderFieldsAreValid(body: Record<string, unknown>): boolean {
	return (
		(body['altbody'] === null || typeof body['altbody'] === 'string') &&
		Array.isArray(body['headers']) &&
		body['headers'].every((entry) => typeof entry === 'object' && entry !== null && !Array.isArray(entry)) &&
		(body['attribs'] === null || (typeof body['attribs'] === 'object' && body['attribs'] !== null && !Array.isArray(body['attribs']))) &&
		typeof body['messenger'] === 'string' &&
		typeof body['archive'] === 'boolean' &&
		(body['archive_slug'] === null || typeof body['archive_slug'] === 'string') &&
		(body['archive_template_id'] === null || (Number.isSafeInteger(body['archive_template_id']) && Number(body['archive_template_id']) > 0)) &&
		(body['archive_meta'] === null || (typeof body['archive_meta'] === 'object' && body['archive_meta'] !== null && !Array.isArray(body['archive_meta']))) &&
		(body['body_source'] === null || typeof body['body_source'] === 'string') &&
		Array.isArray(body['media']) &&
		body['media'].every((id) => Number.isSafeInteger(id) && Number(id) > 0)
	);
}

function campaignTestPayload(campaign: FixtureCampaign, subscriber: FixtureSubscriber): Record<string, unknown> {
	return {
		name: campaign.name,
		subject: campaign.subject,
		lists: campaign.listIds,
		from_email: campaign.fromEmail,
		messenger: campaign.messenger,
		type: 'regular',
		headers: campaign.headers,
		tags: campaign.tags,
		template_id: campaign.templateId,
		content_type: campaign.contentType,
		body: campaign.body,
		altbody: campaign.contentType === 'plain' ? null : campaign.altBody,
		body_source: campaign.bodySource,
		media: campaign.media.flatMap(({ id }) => (id === null ? [] : [id])),
		subscribers: [subscriber.email],
	};
}

function campaignTestBodyIsExact(body: Record<string, unknown>, campaign: FixtureCampaign, subscriber: FixtureSubscriber): boolean {
	return JSON.stringify(body) === JSON.stringify(campaignTestPayload(campaign, subscriber));
}

function renderCampaign(campaign: FixtureCampaign): string {
	if (campaign.contentType === 'plain') return campaign.body;
	const template = fixtureState.emailTemplates.find((candidate) => candidate.id === campaign.templateId) ?? fixtureState.emailTemplates.find((candidate) => candidate.isDefault);
	return template?.body.replace(/\{\{\s*template\s+"content"\s*\.\s*\}\}/g, campaign.body) ?? campaign.body;
}

export async function handleListmonkCampaigns(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
	if (!acceptListmonkRequest(request, response)) return;

	const analyticsMatch = url.pathname.match(/^\/api\/campaigns\/analytics\/(views|clicks)$/);
	if (url.pathname === '/api/config' && request.method === 'GET') {
		sendJson(response, {
			data: { version: 'v6.2.0', messengers: ['email', 'email-primary'] },
		});
		return;
	}
	if (analyticsMatch && request.method === 'GET') {
		if (fixtureState.failNextCampaignAnalyticsRequest) {
			fixtureState.failNextCampaignAnalyticsRequest = false;
			response.writeHead(502, { 'content-type': 'text/plain' });
			response.end('fixture confidential campaign analytics diagnostic');
			return;
		}
		const metric = analyticsMatch[1] as FixtureCampaignAnalyticsRequest['metric'];
		const rawIds = url.searchParams.getAll('id');
		const campaignIds = rawIds.map(Number);
		const from = url.searchParams.get('from') ?? '';
		const to = url.searchParams.get('to') ?? '';
		const fromMatch = /^(\d{4}-\d{2}-\d{2})T00:00:00\.000Z$/.exec(from);
		const toMatch = /^(\d{4}-\d{2}-\d{2})T23:59:59\.999999Z$/.exec(to);
		const validDate = (value: string) => {
			const milliseconds = Date.parse(`${value}T00:00:00Z`);
			return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 10) === value;
		};
		const fromDate = fromMatch?.[1] ?? '';
		const toDate = toMatch?.[1] ?? '';
		if (
			campaignIds.length === 0 ||
			campaignIds.length > 100 ||
			campaignIds.some((id) => !Number.isSafeInteger(id) || id < 1 || !fixtureState.campaigns.some((campaign) => campaign.id === id)) ||
			new Set(campaignIds).size !== campaignIds.length ||
			!validDate(fromDate) ||
			!validDate(toDate) ||
			fromDate > toDate
		) {
			sendJson(response, { message: 'Invalid fixture campaign analytics query.' }, 400);
			return;
		}
		fixtureState.campaignAnalyticsRequests.push({
			metric,
			campaignIds,
			from,
			to,
		});
		const sourceDates = ['2026-08-24T00:00:00Z', '2026-08-23T01:00:00Z', '2026-08-23T14:00:00Z'];
		const data = campaignIds.flatMap((campaignId, campaignIndex) =>
			sourceDates
				.map((timestamp, dateIndex) => ({
					campaign_id: campaignId,
					count: (metric === 'views' ? [12, 5, 8] : [4, 1, 2])[dateIndex]! + campaignIndex,
					timestamp,
				}))
				.filter(({ timestamp }) => timestamp.slice(0, 10) >= fromDate && timestamp.slice(0, 10) <= toDate),
		);
		sendJson(response, { data });
		return;
	}

	if (url.pathname === '/api/campaigns' && request.method === 'GET') {
		const page = Number(url.searchParams.get('page') ?? '1');
		const perPage = Number(url.searchParams.get('per_page') ?? '20');
		const offset = Math.max(0, (page - 1) * perPage);
		const includeBody = url.searchParams.get('no_body') !== 'true';
		sendJson(response, {
			data: {
				results: fixtureState.campaigns.slice(offset, offset + perPage).map((campaign) => providerCampaign(campaign, includeBody)),
				query: '',
				total: fixtureState.campaigns.length,
				per_page: perPage,
				page,
			},
		});
		return;
	}
	if (url.pathname === '/api/campaigns' && request.method === 'POST') {
		const body = await requestJson(request);
		if (!campaignCoreBodyIsValid(body) || !isCampaignType(body['type']) || body['messenger'] !== 'email') {
			sendJson(response, { message: 'Invalid fixture campaign settings.' }, 422);
			return;
		}
		const selectedIds = (body['lists'] as number[]).filter((id) => fixtureState.mailingLists.some((list) => list.id === id));
		if (selectedIds.length !== (body['lists'] as number[]).length) {
			sendJson(response, { message: 'Unknown fixture campaign list.' }, 422);
			return;
		}
		if (body['type'] === 'optin' && selectedIds.some((id) => fixtureState.mailingLists.find((list) => list.id === id)?.optin !== 'double')) {
			sendJson(response, { message: 'Confirmation campaigns require double opt-in lists.' }, 422);
			return;
		}
		const requestedTemplateId = body['template_id'] as number | null;
		const selectedTemplate =
			requestedTemplateId === null
				? fixtureState.emailTemplates.find((template) => template.type === 'campaign' && template.isDefault)
				: fixtureState.emailTemplates.find((template) => template.id === requestedTemplateId && template.type === 'campaign');
		if (!selectedTemplate) {
			sendJson(response, { message: 'Unknown or incompatible fixture campaign template.' }, 422);
			return;
		}
		const now = nextCampaignTimestamp();
		const id = fixtureState.nextCampaignId++;
		const created: FixtureCampaign = {
			id,
			uuid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
			type: body['type'],
			name: String(body['name']),
			subject: String(body['subject']),
			fromEmail: String(body['from_email']) || 'Fixture <fixture@example.test>',
			body: body['type'] === 'optin' ? '<p>Please confirm your subscription.</p><p><a href="{{ OptinURL }}">Confirm subscription</a></p>' : String(body['body']),
			bodySource: null,
			altBody: null,
			sendAt: body['send_at'] as string | null,
			startedAt: null,
			status: 'draft',
			contentType: body['type'] === 'optin' ? 'richtext' : (body['content_type'] as FixtureCampaign['contentType']),
			tags: body['tags'] as string[],
			templateId: selectedTemplate.id,
			messenger: 'email',
			headers: [],
			attribs: {},
			archive: false,
			archiveSlug: null,
			archiveTemplateId: null,
			archiveMeta: {},
			media: [],
			listIds: selectedIds,
			views: 0,
			clicks: 0,
			bounces: 0,
			toSend: selectedIds.reduce((total, listId) => total + (fixtureState.mailingLists.find((list) => list.id === listId)?.subscriberCount ?? 0), 0),
			sent: 0,
			createdAt: now,
			updatedAt: now,
		};
		fixtureState.campaigns.push(created);
		sendJson(response, { data: providerCampaign(created) });
		return;
	}
	if (url.pathname === '/api/campaigns' && request.method === 'DELETE') {
		const ids = url.searchParams.getAll('id').map(Number);
		if (ids.length === 0 || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) {
			sendJson(response, { message: 'Invalid fixture campaign IDs.' }, 400);
			return;
		}
		fixtureState.campaigns = fixtureState.campaigns.filter((campaign) => !ids.includes(campaign.id));
		sendJson(response, { data: true });
		return;
	}

	const previewMatch = url.pathname.match(/^\/api\/campaigns\/(\d+)\/preview$/);
	if (previewMatch && request.method === 'GET') {
		const campaign = fixtureState.campaigns.find(({ id }) => id === Number(previewMatch[1]));
		if (!campaign) {
			sendJson(response, { message: 'Unknown fixture campaign.' }, 400);
			return;
		}
		if (campaign.contentType === 'plain') sendPlain(response, renderCampaign(campaign));
		else sendHtml(response, renderCampaign(campaign));
		return;
	}

	const statusMatch = url.pathname.match(/^\/api\/campaigns\/(\d+)\/status$/);
	if (statusMatch && request.method === 'PUT') {
		const campaign = fixtureState.campaigns.find(({ id }) => id === Number(statusMatch[1]));
		if (!campaign) {
			sendJson(response, { message: 'Unknown fixture campaign.' }, 400);
			return;
		}
		const body = await requestJson(request);
		const target = body['status'];
		const allowed =
			(campaign.status === 'scheduled' && target === 'draft') ||
			((campaign.status === 'draft' || campaign.status === 'paused') && target === 'scheduled' && campaign.sendAt !== null) ||
			((campaign.status === 'draft' || campaign.status === 'paused') && target === 'running') ||
			(campaign.status === 'running' && (target === 'paused' || target === 'cancelled')) ||
			(campaign.status === 'paused' && target === 'cancelled');
		if (!allowed) {
			sendJson(response, { message: 'Invalid fixture campaign status transition.' }, 422);
			return;
		}
		const staleResponse = providerCampaign({
			...campaign,
			status: target as FixtureCampaign['status'],
		});
		campaign.status = target === 'running' && campaign.sendAt !== null ? 'scheduled' : (target as FixtureCampaign['status']);
		campaign.updatedAt = nextCampaignTimestamp();
		if (campaign.status === 'running' && campaign.startedAt === null) campaign.startedAt = campaign.updatedAt;
		sendJson(response, { data: staleResponse });
		return;
	}

	const campaignTestMatch = url.pathname.match(/^\/api\/campaigns\/(\d+)\/test$/);
	if (campaignTestMatch && request.method === 'POST') {
		const campaignId = Number(campaignTestMatch[1]);
		const campaign = fixtureState.campaigns.find(({ id }) => id === campaignId);
		const body = await requestJson(request);
		const recipients = body['subscribers'];
		const subscriber =
			Array.isArray(recipients) && recipients.length === 1 && typeof recipients[0] === 'string' ? fixtureState.subscribers.find(({ email }) => email === recipients[0]) : undefined;
		if (!campaign || !subscriber || !campaignTestBodyIsExact(body, campaign, subscriber)) {
			sendJson(response, { message: 'Invalid fixture campaign test-send payload.' }, 422);
			return;
		}
		const outcome = fixtureState.campaignTestSendOutcome;
		fixtureState.campaignTestSendOutcome = 'accepted';
		if (outcome === 'rejected') {
			sendJson(response, { message: 'Fixture campaign test-send rejected.' }, 422);
			return;
		}
		fixtureState.campaignTestSendRequests.push({ campaignId, payload: body });
		if (outcome === 'ambiguous') {
			response.writeHead(502, { 'content-type': 'text/plain' });
			response.end('fixture confidential campaign test-send diagnostic');
			return;
		}
		sendJson(response, { data: true });
		return;
	}

	const campaignMatch = url.pathname.match(/^\/api\/campaigns\/(\d+)$/);
	if (campaignMatch) {
		const id = Number(campaignMatch[1]);
		const index = fixtureState.campaigns.findIndex((campaign) => campaign.id === id);
		if (index < 0) {
			sendJson(response, { message: 'Unknown fixture campaign.' }, 400);
			return;
		}
		const campaign = fixtureState.campaigns[index] as FixtureCampaign;
		if (request.method === 'GET') {
			sendJson(response, { data: providerCampaign(campaign) });
			return;
		}
		if (request.method === 'PUT') {
			const body = await requestJson(request);
			if (!campaignCoreBodyIsValid(body) || !campaignProviderFieldsAreValid(body) || !['draft', 'scheduled', 'paused'].includes(campaign.status)) {
				sendJson(response, { message: 'Invalid fixture campaign update.' }, 422);
				return;
			}
			const selectedIds = body['lists'] as number[];
			if (selectedIds.some((listId) => !fixtureState.mailingLists.some((list) => list.id === listId))) {
				sendJson(response, { message: 'Unknown fixture campaign list.' }, 422);
				return;
			}
			campaign.name = String(body['name']);
			campaign.subject = String(body['subject']);
			campaign.fromEmail = String(body['from_email']) || 'Fixture <fixture@example.test>';
			campaign.body = String(body['body']);
			campaign.altBody = body['altbody'] as string | null;
			campaign.contentType = body['content_type'] as FixtureCampaign['contentType'];
			campaign.sendAt = body['send_at'] as string | null;
			campaign.headers = body['headers'] as Array<Record<string, string>>;
			campaign.attribs = body['attribs'] as Record<string, unknown> | null;
			campaign.tags = body['tags'] as string[];
			campaign.messenger = String(body['messenger']);
			campaign.templateId = body['template_id'] as number | null;
			campaign.archive = body['archive'] as boolean;
			campaign.archiveSlug = body['archive_slug'] as string | null;
			campaign.archiveTemplateId = body['archive_template_id'] as number | null;
			campaign.archiveMeta = body['archive_meta'] as Record<string, unknown> | null;
			campaign.bodySource = campaign.contentType === 'visual' ? (body['body_source'] as string | null) : null;
			campaign.media = (body['media'] as number[]).map(
				(mediaId) =>
					campaign.media.find(({ id: currentId }) => currentId === mediaId) ?? {
						id: mediaId,
						filename: `media-${mediaId}`,
					},
			);
			campaign.listIds = selectedIds;
			if (campaign.status === 'scheduled' && campaign.sendAt === null) campaign.status = 'draft';
			campaign.updatedAt = nextCampaignTimestamp();
			sendJson(response, { data: providerCampaign(campaign) });
			return;
		}
	}

	sendJson(response, { message: 'Unknown fixture Listmonk campaign endpoint.' }, 404);
}
