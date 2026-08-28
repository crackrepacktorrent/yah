import { describe, expect, it, vi } from 'vitest';
import { CampaignProviderFailure } from '~/features/campaigns/contracts';
import { createListmonkCampaignManager } from './campaign-manager.server';

const config = { LISTMONK_URL: 'https://listmonk.example.test/', LISTMONK_API_TOKEN: 'fixture-token' };

function json(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

function providerCampaign(overrides: Record<string, unknown> = {}) {
	return {
		id: 21,
		created_at: '2026-08-25T10:00:00Z',
		updated_at: '2026-08-25T11:00:00Z',
		uuid: '559197a8-c409-4c0f-8cad-851899d6c26a',
		type: 'regular',
		name: 'August update',
		subject: 'What happened in August',
		from_email: 'YAH <hello@example.test>',
		body: '<p>August news</p>',
		body_source: null,
		altbody: 'August news',
		send_at: null,
		started_at: null,
		status: 'draft',
		content_type: 'richtext',
		tags: ['monthly'],
		template_id: 1,
		messenger: 'email',
		views: 0,
		clicks: 0,
		bounces: 0,
		to_send: 10,
		sent: 0,
		lists: [{ id: 11, name: 'News' }],
		headers: [{ 'x-provider-owned': 'preserve-me' }],
		attribs: { provider: true },
		archive: true,
		archive_slug: 'august-update',
		archive_template_id: 4,
		archive_meta: { section: 'news' },
		media: [{ id: 9, filename: 'guide.pdf' }, { id: null, filename: 'historical.pdf' }],
		...overrides,
	};
}

const createInput = {
	type: 'regular' as const,
	name: 'September update',
	subject: 'September news',
	fromEmail: '',
	listIds: [11],
	body: '<p>September</p>',
	contentType: 'richtext' as const,
	templateId: null,
	tags: ['monthly'],
	sendAt: null,
};

describe('Listmonk campaign manager', () => {
	it('reads one bounded body-free catalog and projects provider DTOs', async () => {
		const request = vi.fn(async (_input: string | URL, _init?: RequestInit) => json({ data: { results: [providerCampaign({ body: '' })], total: 1, page: 1, per_page: 1000 } }));
		const manager = createListmonkCampaignManager(config, request);
		await expect(manager.list()).resolves.toEqual([
			expect.objectContaining({ id: 21, name: 'August update', fromEmail: 'YAH <hello@example.test>', messenger: 'email', status: 'draft', templateId: 1 }),
		]);
		expect(request).toHaveBeenCalledTimes(1);
		const [url, init] = request.mock.calls[0]!;
		expect(url).toBe('https://listmonk.example.test/api/campaigns?page=1&per_page=1000&no_body=true&order_by=created_at&order=desc');
		expect(new Headers(init?.headers).get('Authorization')).toBe('token fixture-token');
	});

	it('accepts Listmonk v6 empty-catalog metadata omission but rejects incomplete and duplicate catalogs', async () => {
		await expect(createListmonkCampaignManager(config, vi.fn(async () => json({ data: { results: [] } }))).list()).resolves.toEqual([]);
		await expect(createListmonkCampaignManager(config, vi.fn(async () => json({ data: { results: [], total: 0, page: 1, per_page: 1000 } }))).list()).resolves.toEqual([]);
		await expect(createListmonkCampaignManager(config, vi.fn(async () => json({ data: { results: [], total: 1, page: 1, per_page: 1000 } }))).list()).rejects.toThrow('incomplete');
		await expect(createListmonkCampaignManager(config, vi.fn(async () => json({ data: { results: [providerCampaign()], total: 2, page: 1, per_page: 1000 } }))).list()).rejects.toThrow('incomplete');
		await expect(createListmonkCampaignManager(config, vi.fn(async () => json({ data: { results: [providerCampaign(), providerCampaign()], total: 2, page: 1, per_page: 1000 } }))).list()).rejects.toThrow('duplicate');
	});

	it('normalizes detail and treats only v6 missing-ID statuses as a nullable lookup', async () => {
		const detail = createListmonkCampaignManager(config, vi.fn(async () => json({ data: providerCampaign({ body_source: '{"rows":[]}' }) })));
		await expect(detail.get(21)).resolves.toEqual(expect.objectContaining({ body: '<p>August news</p>' }));
		await expect(createListmonkCampaignManager(config, vi.fn(async () => json({ error: 'missing' }, 400))).get(99)).resolves.toBeNull();
		await expect(createListmonkCampaignManager(config, vi.fn(async () => json({ error: 'down' }, 503))).get(21)).rejects.toBeInstanceOf(CampaignProviderFailure);
	});

	it('creates a regular or opt-in campaign with an explicit email messenger', async () => {
		const request = vi.fn(async (_input: string | URL, _init?: RequestInit) => json({ data: providerCampaign({ name: createInput.name, subject: createInput.subject }) }));
		await createListmonkCampaignManager(config, request).create(createInput);
		const [, init] = request.mock.calls[0]!;
		expect(JSON.parse(String(init?.body))).toEqual({
			name: createInput.name,
			subject: createInput.subject,
			from_email: '',
			lists: [11],
			body: createInput.body,
			content_type: 'richtext',
			template_id: null,
			tags: ['monthly'],
			send_at: null,
			type: 'regular',
			messenger: 'email',
		});
	});

	it('updates the complete app-owned draft surface without overwriting provider-owned fields', async () => {
		const request = vi.fn(async (_input: string | URL, _init?: RequestInit) => json({ data: providerCampaign({ name: 'Changed' }) }));
		await createListmonkCampaignManager(config, request).update({ id: 21, expectedUpdatedAt: '2026-08-25T11:00:00Z', ...createInput, name: 'Changed' });
		const [url, init] = request.mock.calls[1]!;
		expect(url).toBe('https://listmonk.example.test/api/campaigns/21');
		expect(JSON.parse(String(init?.body))).toEqual({
			name: 'Changed',
			subject: createInput.subject,
			from_email: '',
			lists: [11],
			body: createInput.body,
			content_type: 'richtext',
			template_id: null,
			tags: ['monthly'],
			send_at: null,
			altbody: 'August news',
			headers: [{ 'x-provider-owned': 'preserve-me' }],
			attribs: { provider: true },
			messenger: 'email',
			archive: true,
			archive_slug: 'august-update',
			archive_template_id: 4,
			archive_meta: { section: 'news' },
			body_source: null,
			media: [9],
		});
		expect(request).toHaveBeenCalledTimes(2);
	});

	it('uses one provider bulk-delete request and validates its acknowledgement', async () => {
		const request = vi.fn(async (_input: string | URL, _init?: RequestInit) => json({ data: true }));
		await createListmonkCampaignManager(config, request).delete([21, 22]);
		const [url, init] = request.mock.calls[0]!;
		expect(url).toBe('https://listmonk.example.test/api/campaigns?id=21&id=22');
		expect(init?.method).toBe('DELETE');
	});

	it('sends only the server-selected target status and validates the returned campaign', async () => {
		const request = vi.fn(async (_input: string | URL, _init?: RequestInit) => json({ data: providerCampaign({ status: 'paused' }) }));
		await expect(createListmonkCampaignManager(config, request).transition(21, 'paused')).resolves.toEqual(expect.objectContaining({ status: 'paused' }));
		expect(JSON.parse(String(request.mock.calls[0]![1]?.body))).toEqual({ status: 'paused' });
		expect(request).toHaveBeenCalledTimes(2);

		const ignored = vi.fn(async (_input: string | URL, _init?: RequestInit) => json({ data: providerCampaign({ status: 'running' }) }));
		await expect(createListmonkCampaignManager(config, ignored).transition(21, 'paused')).rejects.toThrow('did not apply');
	});

	it('loads a bounded HTML preview and classifies provider failures without response text', async () => {
		const request = vi.fn(async () => new Response('<p>Rendered</p>', { headers: { 'Content-Type': 'text/html' } }));
		await expect(createListmonkCampaignManager(config, request).preview(21)).resolves.toBe('<p>Rendered</p>');
		await expect(createListmonkCampaignManager(config, vi.fn(async () => json({ message: 'private diagnostic' }, 422))).preview(21)).rejects.toMatchObject({ name: 'CampaignProviderFailure', status: 422 });
	});

	it('rejects malformed provider responses at the adapter boundary', async () => {
		const manager = createListmonkCampaignManager(config, vi.fn(async () => json({ data: providerCampaign({ status: 'mystery' }) })));
		await expect(manager.get(21)).rejects.toThrow('invalid campaign detail');
	});
});
