import { describe, expect, it, vi } from 'vitest';
import { TemplateProviderFailure } from '~/features/email-templates/contracts';
import { createListmonkTemplateManager } from './template-manager.server';

const config = { LISTMONK_URL: 'https://mail.example/', LISTMONK_API_TOKEN: 'admin:secret-token' };
const providerTemplate = {
	id: 7,
	created_at: '2026-08-25T12:00:00Z',
	updated_at: '2026-08-26T13:30:00Z',
	name: 'Press updates',
	subject: 'Latest news',
	type: 'tx',
	body: '<p>Hello</p>',
	body_source: null,
	is_default: false,
	ignored_provider_field: 'not part of the feature contract',
};

function json(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

describe('Listmonk template manager', () => {
	it('lists without bodies, reads details, and normalizes snake_case DTOs', async () => {
		const requests: Array<{ url: URL; init: RequestInit }> = [];
		const request = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
			const url = new URL(input);
			requests.push({ url, init });
			return url.searchParams.has('no_body')
				? json({ data: [{ ...providerTemplate, body: undefined }] })
				: json({ data: providerTemplate });
		});
		const manager = createListmonkTemplateManager(config, request);

		await expect(manager.list()).resolves.toEqual([
			{
				id: 7,
				name: 'Press updates',
				kind: 'tx',
				subject: 'Latest news',
				isDefault: false,
				createdAt: '2026-08-25T12:00:00Z',
				updatedAt: '2026-08-26T13:30:00Z',
			},
		]);
		await expect(manager.get(7)).resolves.toEqual({
			id: 7,
			name: 'Press updates',
			kind: 'tx',
			subject: 'Latest news',
			body: '<p>Hello</p>',
			hasVisualSource: false,
			isDefault: false,
			createdAt: '2026-08-25T12:00:00Z',
			updatedAt: '2026-08-26T13:30:00Z',
		});

		expect(requests.map(({ url }) => `${url.pathname}${url.search}`)).toEqual([
			'/api/templates?no_body=true',
			'/api/templates/7',
		]);
		for (const { init } of requests) {
			const headers = new Headers(init.headers);
			expect(headers.get('accept')).toBe('application/json');
			expect(headers.get('authorization')).toBe('token admin:secret-token');
			expect(headers.get('content-type')).toBeNull();
		}
	});

	it('uses exact create, update, delete, and set-default protocols', async () => {
		const requests: Array<{ url: URL; init: RequestInit }> = [];
		const request = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
			const url = new URL(input);
			requests.push({ url, init });
			if (init.method === 'DELETE') return json({ data: true });
			if (url.pathname.endsWith('/default')) {
				return json({ data: [{ ...providerTemplate, type: 'campaign', is_default: true }] });
			}
			return json({ data: providerTemplate });
		});
		const manager = createListmonkTemplateManager(config, request);

		await expect(
			manager.create({ name: 'Press updates', kind: 'tx', subject: 'Latest news', body: '<p>Hello</p>' }),
		).resolves.toEqual(expect.objectContaining({ id: 7, kind: 'tx', body: '<p>Hello</p>' }));
		await manager.update({ id: 7, name: 'Updated', subject: 'Updated news', body: '<p>Updated</p>' });
		await manager.delete(7);
		await manager.setDefault(7);

		expect(requests.map(({ url, init }) => [url.pathname, init.method])).toEqual([
			['/api/templates', 'POST'],
			['/api/templates/7', 'PUT'],
			['/api/templates/7', 'DELETE'],
			['/api/templates/7/default', 'PUT'],
		]);
		expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
			name: 'Press updates',
			type: 'tx',
			subject: 'Latest news',
			body: '<p>Hello</p>',
		});
		expect(JSON.parse(String(requests[1]?.init.body))).toEqual({
			name: 'Updated',
			subject: 'Updated news',
			body: '<p>Updated</p>',
		});
		for (const { init } of requests.filter(({ init }) => init.body !== undefined)) {
			expect(new Headers(init.headers).get('content-type')).toBe('application/json');
		}
	});

	it('rejects a set-default response that does not confirm the requested default', async () => {
		const manager = createListmonkTemplateManager(
			config,
			vi.fn(async () => json({ data: [providerTemplate] })),
		);

		await expect(manager.setDefault(7)).rejects.toThrow('invalid default-template response');
	});

	it('uses GET for saved previews and form encoding for draft previews', async () => {
		const requests: Array<{ url: URL; init: RequestInit }> = [];
		const request = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
			requests.push({ url: new URL(input), init });
			return new Response('<main>Rendered preview</main>', { headers: { 'content-type': 'text/html; charset=UTF-8' } });
		});
		const manager = createListmonkTemplateManager(config, request);

		await expect(manager.previewSaved(7)).resolves.toBe('<main>Rendered preview</main>');
		await expect(manager.previewDraft({ kind: 'campaign', body: '<p>A & B</p>' })).resolves.toContain('Rendered preview');

		expect(requests.map(({ url, init }) => [url.pathname, init.method])).toEqual([
			['/api/templates/7/preview', undefined],
			['/api/templates/preview', 'POST'],
		]);
		expect(String(requests[1]?.init.body)).toBe('template_type=campaign&body=%3Cp%3EA+%26+B%3C%2Fp%3E');
		const savedHeaders = new Headers(requests[0]?.init.headers);
		const draftHeaders = new Headers(requests[1]?.init.headers);
		expect(savedHeaders.get('accept')).toBe('text/html');
		expect(savedHeaders.get('content-type')).toBeNull();
		expect(draftHeaders.get('accept')).toBe('text/html');
		expect(draftHeaders.get('content-type')).toBe('application/x-www-form-urlencoded;charset=UTF-8');
	});

	it.each([400, 404])('normalizes a missing detail status %i to null', async (status) => {
		const missing = createListmonkTemplateManager(config, vi.fn(async () => json({ message: 'missing' }, status)));
		await expect(missing.get(404)).resolves.toBeNull();
	});

	it('exposes diagnostic-free provider failures', async () => {
		const missing = createListmonkTemplateManager(config, vi.fn(async () => json({ message: 'missing' }, 404)));
		await expect(missing.previewSaved(404)).rejects.toEqual(expect.objectContaining({ name: 'TemplateProviderFailure', status: 404 }));

		const diagnostic = `upstream leaked ${config.LISTMONK_API_TOKEN}`;
		const failing = createListmonkTemplateManager(
			config,
			vi.fn(async () => new Response(diagnostic, { status: 502, headers: { 'content-type': 'text/plain' } })),
		);
		const error = await failing.list().catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(TemplateProviderFailure);
		expect(error).toMatchObject({ status: 502 });
		expect(String(error)).not.toContain(diagnostic);
		expect(String(error)).not.toContain(config.LISTMONK_API_TOKEN);
	});

	it.each([
		['successful non-JSON', () => new Response('<html>proxy</html>', { headers: { 'content-type': 'text/html' } }), /expected JSON/],
		['malformed JSON', () => new Response('{', { headers: { 'content-type': 'application/json' } }), /malformed JSON/],
		['invalid DTO', () => json({ data: [{ ...providerTemplate, id: 'seven' }] }), /invalid template-list/],
	] as const)('fails closed for %s responses', async (_label, response, expected) => {
		const manager = createListmonkTemplateManager(config, vi.fn(async () => response()));
		await expect(manager.list()).rejects.toThrow(expected);
	});
});
