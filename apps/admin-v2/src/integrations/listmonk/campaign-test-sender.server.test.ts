import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import {
	CampaignTestSendAmbiguousFailure,
	CampaignTestSendPreconditionFailure,
	type SendCampaignTestCommand,
} from '~/features/campaign-test-sends/contracts';
import { createListmonkCampaignTestSender } from './campaign-test-sender.server';

const config = { LISTMONK_URL: 'https://mail.example/', LISTMONK_API_TOKEN: 'admin:secret-token' };
const validCommand: SendCampaignTestCommand = {
	campaignId: 21,
	expectedCampaignUpdatedAt: '2026-08-25T11:00:00Z',
	subscriberId: 31,
	expectedSubscriberUpdatedAt: '2026-08-25T12:00:00Z',
};

function json(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

function providerCampaign(overrides: Record<string, unknown> = {}) {
	return {
		id: 21,
		updated_at: validCommand.expectedCampaignUpdatedAt,
		type: 'regular',
		name: 'August update',
		subject: 'What happened in August',
		from_email: 'YAH <hello@example.test>',
		body: '<p>August news</p>',
		body_source: '{"rows":[]}',
		altbody: 'August news',
		status: 'draft',
		content_type: 'richtext',
		tags: ['monthly', 'members'],
		template_id: 4,
		messenger: 'email',
		headers: [{ 'x-provider-owned': 'preserve-me' }],
		media: [{ id: 9, filename: 'guide.pdf' }, { id: null, filename: 'historical.pdf' }],
		lists: [{ id: 11, name: 'News' }, { id: 12, name: 'Members' }],
		created_at: '2026-08-25T10:00:00Z',
		attribs: { provider: true },
		archive: true,
		send_at: null,
		...overrides,
	};
}

function providerSubscriber(overrides: Record<string, unknown> = {}) {
	return {
		id: 31,
		updated_at: validCommand.expectedSubscriberUpdatedAt,
		email: 'Member+Test@Example.test',
		status: 'enabled',
		lists: [
			{ id: 11, status: 'active', subscription_status: 'confirmed', name: 'News' },
			{ id: 99, status: 'active', subscription_status: 'confirmed', name: 'Unrelated' },
		],
		name: 'Member',
		attribs: { tier: 'member' },
		...overrides,
	};
}

type RequestDoubleOptions = {
	campaign?: unknown;
	subscriber?: unknown;
	messengerConfig?: unknown;
	post?: () => Promise<Response> | Response;
};

function requestDouble(options: RequestDoubleOptions = {}) {
	return vi.fn(async (input: string | URL, init: RequestInit = {}) => {
		const url = String(input);
		if (url.endsWith('/api/campaigns/21') && init.method === undefined) {
			return json({ data: Object.hasOwn(options, 'campaign') ? options.campaign : providerCampaign() });
		}
		if (url.endsWith('/api/subscribers/31') && init.method === undefined) {
			return json({ data: Object.hasOwn(options, 'subscriber') ? options.subscriber : providerSubscriber() });
		}
		if (url.endsWith('/api/config') && init.method === undefined && Object.hasOwn(options, 'messengerConfig')) {
			return json(options.messengerConfig);
		}
		if (url.endsWith('/api/campaigns/21/test') && init.method === 'POST') {
			return options.post ? options.post() : json({ data: true });
		}
		throw new Error(`Unexpected request: ${init.method ?? 'GET'} ${url}`);
	});
}

function postCalls(request: ReturnType<typeof requestDouble>) {
	return request.mock.calls.filter(([, init]) => init?.method === 'POST');
}

async function expectPrecondition(
	promise: Promise<void>,
	reason: string,
): Promise<void> {
	await expect(promise).rejects.toMatchObject({
		name: 'CampaignTestSendPreconditionFailure',
		reason,
	});
}

describe('Listmonk campaign test sender', () => {
	it('keeps the built-in email messenger on the exact preflight path with no config fetch', async () => {
		const request = requestDouble();
		const sender = createListmonkCampaignTestSender(config, request);

		await expect(sender.send(validCommand)).resolves.toBeUndefined();

		expect(request).toHaveBeenCalledTimes(3);
		expect(request.mock.calls.map(([input, init]) => [String(input), init?.method ?? 'GET'])).toEqual([
			['https://mail.example/api/campaigns/21', 'GET'],
			['https://mail.example/api/subscribers/31', 'GET'],
			['https://mail.example/api/campaigns/21/test', 'POST'],
		]);
		expect(request.mock.calls.filter(([input]) => String(input).endsWith('/api/config'))).toHaveLength(0);
		for (const [, init] of request.mock.calls) {
			const headers = new Headers(init?.headers);
			expect(headers.get('accept')).toBe('application/json');
			expect(headers.get('authorization')).toBe('token admin:secret-token');
		}
		const post = request.mock.calls[2];
		if (!post) throw new Error('Expected one Listmonk test-send POST.');
		expect(new Headers(post[1]?.headers).get('content-type')).toBe('application/json');
		expect(JSON.parse(String(post[1]?.body))).toEqual({
			name: 'August update',
			subject: 'What happened in August',
			lists: [11, 12],
			from_email: 'YAH <hello@example.test>',
			messenger: 'email',
			type: 'regular',
			headers: [{ 'x-provider-owned': 'preserve-me' }],
			tags: ['monthly', 'members'],
			template_id: 4,
			content_type: 'richtext',
			body: '<p>August news</p>',
			altbody: 'August news',
			body_source: '{"rows":[]}',
			media: [9],
			subscribers: ['Member+Test@Example.test'],
		});
	});

	it('accepts an exact active named SMTP messenger and preserves it in one test-send POST', async () => {
		const request = requestDouble({
			campaign: providerCampaign({ messenger: 'email-primary' }),
			messengerConfig: { data: { messengers: ['email', 'email-primary', 'email-secondary'] } },
		});

		await expect(createListmonkCampaignTestSender(config, request).send(validCommand)).resolves.toBeUndefined();
		expect(request.mock.calls.filter(([input]) => String(input).endsWith('/api/config'))).toHaveLength(1);
		expect(postCalls(request)).toHaveLength(1);
		expect(JSON.parse(String(postCalls(request)[0]?.[1]?.body))).toMatchObject({
			messenger: 'email-primary',
			subscribers: ['Member+Test@Example.test'],
		});
	});

	it.each([
		['missing', ['email', 'email-secondary']],
		['disabled', ['email']],
	])('rejects a %s named SMTP messenger after one fresh config fetch and before POST', async (_label, messengers) => {
		const request = requestDouble({
			campaign: providerCampaign({ messenger: 'email-primary' }),
			messengerConfig: { data: { messengers } },
		});

		await expectPrecondition(
			createListmonkCampaignTestSender(config, request).send(validCommand),
			'campaign-messenger',
		);
		expect(request.mock.calls.filter(([input]) => String(input).endsWith('/api/config'))).toHaveLength(1);
		expect(postCalls(request)).toHaveLength(0);
	});

	it('rejects a non-email messenger before subscriber, config, or POST access', async () => {
		const request = requestDouble({ campaign: providerCampaign({ messenger: 'sms' }) });

		await expectPrecondition(
			createListmonkCampaignTestSender(config, request).send(validCommand),
			'campaign-messenger',
		);
		expect(request).toHaveBeenCalledOnce();
		expect(String(request.mock.calls[0]?.[0])).toBe('https://mail.example/api/campaigns/21');
		expect(postCalls(request)).toHaveLength(0);
	});

	it.each([
		['missing envelope', {}],
		['non-array registry', { data: { messengers: 'email-primary' } }],
		['duplicate names', { data: { messengers: ['email', 'email-primary', 'email-primary'] } }],
		['invalid name', { data: { messengers: ['email', ''] } }],
	])('fails closed on a %s config response with zero POSTs', async (_label, messengerConfig) => {
		const request = requestDouble({
			campaign: providerCampaign({ messenger: 'email-primary' }),
			messengerConfig,
		});

		await expect(createListmonkCampaignTestSender(config, request).send(validCommand)).rejects.toThrow(
			'Listmonk returned an invalid configuration preflight response',
		);
		expect(request.mock.calls.filter(([input]) => String(input).endsWith('/api/config'))).toHaveLength(1);
		expect(postCalls(request)).toHaveLength(0);
	});

	it('fetches the named SMTP registry fresh for each separate send instead of caching it', async () => {
		const request = requestDouble({
			campaign: providerCampaign({ messenger: 'email-primary' }),
			messengerConfig: { data: { messengers: ['email', 'email-primary'] } },
		});
		const sender = createListmonkCampaignTestSender(config, request);

		await sender.send(validCommand);
		await sender.send(validCommand);

		expect(request.mock.calls.filter(([input]) => String(input).endsWith('/api/config'))).toHaveLength(2);
		expect(postCalls(request)).toHaveLength(2);
	});

	it('omits null media IDs and provider-only fields, normalizes nullable body source, and clears plain-text alt body', async () => {
		const request = requestDouble({
			campaign: providerCampaign({
				content_type: 'plain',
				body_source: undefined,
				altbody: 'must not shadow the plain body',
				media: [{ id: null }],
			}),
		});

		await createListmonkCampaignTestSender(config, request).send(validCommand);
		const payload = JSON.parse(String(postCalls(request)[0]?.[1]?.body));
		expect(payload).toMatchObject({
			content_type: 'plain',
			altbody: null,
			body_source: null,
			media: [],
		});
		for (const omitted of ['id', 'updated_at', 'created_at', 'status', 'attribs', 'archive', 'send_at']) {
			expect(payload).not.toHaveProperty(omitted);
		}
	});

	it('rejects invalid direct-call commands without touching the transport', async () => {
		const request = requestDouble();
		const sender = createListmonkCampaignTestSender(config, request);
		const invalidCommands: unknown[] = [
			{ ...validCommand, campaignId: 0 },
			{ ...validCommand, subscriberId: 1.5 },
			{ ...validCommand, expectedCampaignUpdatedAt: 'invalid' },
			{ ...validCommand, unexpected: true },
		];

		for (const input of invalidCommands) {
			await expect(sender.send(input as SendCampaignTestCommand)).rejects.toThrow(
				'Listmonk campaign test-send requires a valid command',
			);
		}
		expect(request).not.toHaveBeenCalled();
	});

	it.each([
		{ status: 400, reason: 'campaign-not-found' },
		{ status: 404, reason: 'campaign-not-found' },
	])('maps a campaign lookup $status to $reason without looking up the subscriber', async ({ status, reason }) => {
		const request = vi.fn(async () => json({ message: 'diagnostic must stay private' }, status));
		await expectPrecondition(createListmonkCampaignTestSender(config, request).send(validCommand), reason);
		expect(request).toHaveBeenCalledOnce();
		expect(postCalls(request as ReturnType<typeof requestDouble>)).toHaveLength(0);
	});

	it.each([
		{ status: 400, reason: 'subscriber-not-found' },
		{ status: 404, reason: 'subscriber-not-found' },
	])('maps a subscriber lookup $status to $reason without posting', async ({ status, reason }) => {
		const request = vi.fn(async (input: string | URL) => String(input).includes('/campaigns/')
			? json({ data: providerCampaign() })
			: json({ message: 'diagnostic must stay private' }, status));
		await expectPrecondition(createListmonkCampaignTestSender(config, request).send(validCommand), reason);
		expect(request).toHaveBeenCalledTimes(2);
		expect(postCalls(request as ReturnType<typeof requestDouble>)).toHaveLength(0);
	});

	it('rejects stale targets at the earliest bound lookup and never posts', async () => {
		const staleCampaignRequest = requestDouble({ campaign: providerCampaign({ updated_at: '2026-08-26T00:00:00Z' }) });
		await expectPrecondition(
			createListmonkCampaignTestSender(config, staleCampaignRequest).send(validCommand),
			'campaign-stale',
		);
		expect(staleCampaignRequest).toHaveBeenCalledOnce();
		expect(postCalls(staleCampaignRequest)).toHaveLength(0);

		const staleSubscriberRequest = requestDouble({ subscriber: providerSubscriber({ updated_at: '2026-08-26T00:00:00Z' }) });
		await expectPrecondition(
			createListmonkCampaignTestSender(config, staleSubscriberRequest).send(validCommand),
			'subscriber-stale',
		);
		expect(staleSubscriberRequest).toHaveBeenCalledTimes(2);
		expect(postCalls(staleSubscriberRequest)).toHaveLength(0);
	});

	it('fails closed on wrong provider IDs or malformed lookup responses and never posts', async () => {
		const scenarios = [
			{ campaign: providerCampaign({ id: 22 }), message: 'wrong campaign test-send target', calls: 1 },
			{ subscriber: providerSubscriber({ id: 32 }), message: 'wrong subscriber test-send target', calls: 2 },
			{ campaign: null, message: 'invalid campaign test-send preflight', calls: 1 },
			{ subscriber: null, message: 'invalid subscriber test-send preflight', calls: 2 },
			{ campaign: { ...providerCampaign(), status: 'invented' }, message: 'invalid campaign test-send preflight', calls: 1 },
			{ subscriber: { ...providerSubscriber(), email: 'not-an-email' }, message: 'invalid subscriber test-send preflight', calls: 2 },
		];

		for (const scenario of scenarios) {
			const request = requestDouble(scenario);
			await expect(createListmonkCampaignTestSender(config, request).send(validCommand)).rejects.toThrow(scenario.message);
			expect(request).toHaveBeenCalledTimes(scenario.calls);
			expect(postCalls(request)).toHaveLength(0);
		}
	});

	it.each([
		{ campaign: { type: 'optin' }, subscriber: {}, reason: 'campaign-type', calls: 1 },
		{ campaign: { status: 'scheduled' }, subscriber: {}, reason: 'campaign-status', calls: 1 },
		{ campaign: { messenger: 'sms' }, subscriber: {}, reason: 'campaign-messenger', calls: 1 },
		{ campaign: {}, subscriber: { status: 'disabled' }, reason: 'subscriber-status', calls: 2 },
		{ campaign: {}, subscriber: { status: 'blocklisted' }, reason: 'subscriber-status', calls: 2 },
		{
			campaign: {},
			subscriber: { lists: [{ id: 11, status: 'archived', subscription_status: 'confirmed' }] },
			reason: 'subscriber-membership',
			calls: 2,
		},
		{
			campaign: {},
			subscriber: { lists: [{ id: 11, status: 'active', subscription_status: 'unconfirmed' }] },
			reason: 'subscriber-membership',
			calls: 2,
		},
		{
			campaign: {},
			subscriber: { lists: [{ id: 99, status: 'active', subscription_status: 'confirmed' }] },
			reason: 'subscriber-membership',
			calls: 2,
		},
	])('rejects ineligible campaign/subscriber state as $reason with zero POSTs', async ({ campaign, subscriber, reason, calls }) => {
		const request = requestDouble({
			campaign: providerCampaign(campaign),
			subscriber: providerSubscriber(subscriber),
		});
		await expectPrecondition(createListmonkCampaignTestSender(config, request).send(validCommand), reason);
		expect(request).toHaveBeenCalledTimes(calls);
		expect(postCalls(request)).toHaveLength(0);
	});

	it('fails closed on zero, duplicate, or malformed campaign targets and duplicate subscriber memberships', async () => {
		const scenarios = [
			{ campaign: providerCampaign({ lists: [] }), subscriber: providerSubscriber() },
			{ campaign: providerCampaign({ lists: [{ id: 11 }, { id: 11 }] }), subscriber: providerSubscriber() },
			{ campaign: providerCampaign({ lists: [{ id: 11 }, { id: 0 }] }), subscriber: providerSubscriber() },
			{ campaign: providerCampaign(), subscriber: providerSubscriber({
				lists: [
					{ id: 11, status: 'active', subscription_status: 'confirmed' },
					{ id: 11, status: 'active', subscription_status: 'confirmed' },
				],
			}) },
		];

		for (const scenario of scenarios) {
			const request = requestDouble(scenario);
			await expect(createListmonkCampaignTestSender(config, request).send(validCommand)).rejects.toThrow();
			expect(postCalls(request)).toHaveLength(0);
		}
	});

	it.each([400, 404, 409, 422, 429])('classifies a definite POST %s as provider-rejected with exactly one POST', async (status) => {
		const request = requestDouble({ post: () => json({ message: 'private rejection detail' }, status) });
		await expectPrecondition(
			createListmonkCampaignTestSender(config, request).send(validCommand),
			'provider-rejected',
		);
		expect(postCalls(request)).toHaveLength(1);
		expect(request).toHaveBeenCalledTimes(3);
	});

	it.each([
		{ name: 'network failure', post: () => Promise.reject(new Error('connection reset')) },
		{ name: 'server failure', post: () => json({ message: 'internal error' }, 503) },
		{ name: 'false acknowledgement', post: () => json({ data: false }) },
		{ name: 'missing acknowledgement', post: () => json({}) },
		{ name: 'non-exact acknowledgement', post: () => json({ data: true, unexpected: true }) },
		{ name: 'malformed JSON acknowledgement', post: () => new Response('not-json', { headers: { 'content-type': 'application/json' } }) },
	])('classifies $name after POST as ambiguous and never retries', async ({ post }) => {
		const request = requestDouble({ post });
		await expect(createListmonkCampaignTestSender(config, request).send(validCommand)).rejects.toBeInstanceOf(
			CampaignTestSendAmbiguousFailure,
		);
		expect(postCalls(request)).toHaveLength(1);
		expect(request).toHaveBeenCalledTimes(3);
	});

	it.each([307, 308])('does not follow a %s redirect after the mutation may have reached Listmonk', async (status) => {
		let originalEndpointRequests = 0;
		let redirectTargetRequests = 0;
		const server = createServer((request, response) => {
			const sendJson = (value: unknown) => {
				response.writeHead(200, { 'content-type': 'application/json' });
				response.end(JSON.stringify(value));
			};
			if (request.method === 'GET' && request.url === '/api/campaigns/21') {
				sendJson({ data: providerCampaign() });
				return;
			}
			if (request.method === 'GET' && request.url === '/api/subscribers/31') {
				sendJson({ data: providerSubscriber() });
				return;
			}
			if (request.method === 'POST' && request.url === '/api/campaigns/21/test') {
				originalEndpointRequests += 1;
				response.writeHead(status, { location: '/redirect-target' });
				response.end();
				return;
			}
			if (request.url === '/redirect-target') {
				redirectTargetRequests += 1;
				sendJson({ data: true });
				return;
			}
			response.writeHead(404);
			response.end();
		});

		await new Promise<void>((resolve, reject) => {
			server.once('error', reject);
			server.listen(0, '127.0.0.1', resolve);
		});
		try {
			const address = server.address() as AddressInfo;
			const sender = createListmonkCampaignTestSender({
				...config,
				LISTMONK_URL: `http://127.0.0.1:${address.port}`,
			}, fetch);

			await expect(sender.send(validCommand)).rejects.toBeInstanceOf(CampaignTestSendAmbiguousFailure);
			expect(originalEndpointRequests).toBe(1);
			expect(redirectTargetRequests).toBe(0);
		} finally {
			await new Promise<void>((resolve, reject) => {
				server.close((error) => error ? reject(error) : resolve());
			});
		}
	});

	it('does not misclassify pre-POST transport failures as possibly queued', async () => {
		const campaignFailure = new Error('campaign connection failed');
		const request = vi.fn(async () => { throw campaignFailure; });

		await expect(createListmonkCampaignTestSender(config, request).send(validCommand)).rejects.toBe(campaignFailure);
		expect(request).toHaveBeenCalledOnce();
	});

	it('exposes the typed failure constructors used by the adapter', () => {
		expect(new CampaignTestSendPreconditionFailure('provider-rejected')).toMatchObject({
			name: 'CampaignTestSendPreconditionFailure',
			reason: 'provider-rejected',
		});
	});
});
