import { describe, expect, it, vi } from 'vitest';
import { MailingListProviderFailure } from '~/features/mailing-lists/contracts';
import { createListmonkMailingListManager } from './mailing-list-manager.server';

const config = { LISTMONK_URL: 'https://mail.example/', LISTMONK_API_TOKEN: 'admin:secret-token' };

function providerList(id: number, overrides: Record<string, unknown> = {}) {
	return {
		id,
		created_at: '2026-08-25T12:00:00Z',
		updated_at: '2026-08-26T13:30:00Z',
		uuid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
		name: `Mailing list ${id}`,
		type: 'public',
		optin: 'double',
		status: 'active',
		description: `Description ${id}`,
		tags: ['press', 'weekly'],
		subscriber_count: 25,
		subscriber_statuses: { confirmed: 21, unconfirmed: 4 },
		ignored_provider_field: 'not part of the feature contract',
		...overrides,
	};
}

function json(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function catalog(results: unknown[], total = results.length): Response {
	return json({ data: { results, total, page: 1, per_page: 1_000 } });
}

describe('Listmonk mailing-list manager', () => {
	it('fetches one bounded complete catalog and normalizes all 21 rows including temporary lists', async () => {
		const rows = Array.from({ length: 21 }, (_, index) =>
			providerList(index + 1, index === 20 ? { type: 'temporary', subscriber_statuses: {} } : {}),
		);
		const request = vi.fn(async (_input: string | URL, _init: RequestInit = {}) => catalog(rows));
		const manager = createListmonkMailingListManager(config, request);

		const lists = await manager.list();

		expect(lists).toHaveLength(21);
		expect(lists[0]).toEqual({
			id: 1,
			uuid: '00000000-0000-4000-8000-000000000001',
			name: 'Mailing list 1',
			kind: 'public',
			optIn: 'double',
			status: 'active',
			description: 'Description 1',
			tags: ['press', 'weekly'],
			subscriberCount: 25,
			unconfirmedCount: 4,
			createdAt: '2026-08-25T12:00:00Z',
			updatedAt: '2026-08-26T13:30:00Z',
		});
		expect(lists[20]).toEqual(expect.objectContaining({ kind: 'temporary', unconfirmedCount: 0 }));
		expect(request).toHaveBeenCalledTimes(1);
		const firstRequest = request.mock.calls[0];
		expect(firstRequest).toBeDefined();
		if (!firstRequest) throw new Error('Expected one Listmonk request.');
		const [url, init] = firstRequest;
		expect(String(url)).toBe('https://mail.example/api/lists?page=1&per_page=1000');
		expect(init?.method).toBeUndefined();
		const headers = new Headers(init?.headers);
		expect(headers.get('accept')).toBe('application/json');
		expect(headers.get('authorization')).toBe('token admin:secret-token');
		expect(headers.get('content-type')).toBeNull();
	});

	it('rejects a complete catalog above the safety cap', async () => {
		const rows = Array.from({ length: 1_001 }, (_, index) => providerList(index + 1));
		const manager = createListmonkMailingListManager(config, vi.fn(async () => catalog(rows)));

		await expect(manager.list()).rejects.toThrow('exceeds the 1000-list safety limit');
	});

	it('rejects a catalog whose reported total does not match the returned rows', async () => {
		const rows = Array.from({ length: 21 }, (_, index) => providerList(index + 1));
		const manager = createListmonkMailingListManager(config, vi.fn(async () => catalog(rows, 22)));

		await expect(manager.list()).rejects.toThrow('incomplete mailing-list catalog');
	});

	it('rejects a catalog response that did not honor the requested page bound', async () => {
		const manager = createListmonkMailingListManager(
			config,
			vi.fn(async () => json({ data: { results: [providerList(1)], total: 1, page: 1, per_page: 20 } })),
		);

		await expect(manager.list()).rejects.toThrow('did not honor the bounded mailing-list catalog request');
	});

	it('gets a detail and uses exact create, full update, and singular delete protocols', async () => {
		const requests: Array<{ url: URL; init: RequestInit }> = [];
		const request = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
			const url = new URL(input);
			requests.push({ url, init });
			if (init.method === 'DELETE') return json({ data: true });
			return json({ data: providerList(7, { name: 'Press updates' }) });
		});
		const manager = createListmonkMailingListManager(config, request);

		await expect(manager.get(7)).resolves.toEqual(expect.objectContaining({ id: 7, name: 'Press updates' }));
		await expect(
			manager.create({ name: 'New list', kind: 'private', optIn: 'single', description: 'New description' }),
		).resolves.toEqual(expect.objectContaining({ id: 7 }));
		await manager.update({
			id: 7,
			name: 'Updated list',
			kind: 'private',
			optIn: 'single',
			status: 'archived',
			description: 'Preserve this description',
			tags: ['preserve', 'these'],
		});
		await manager.delete(7);

		expect(requests.map(({ url, init }) => [`${url.pathname}${url.search}`, init.method])).toEqual([
			['/api/lists/7', undefined],
			['/api/lists', 'POST'],
			['/api/lists/7', 'PUT'],
			['/api/lists/7', 'DELETE'],
		]);
		expect(JSON.parse(String(requests[1]?.init.body))).toEqual({
			name: 'New list',
			type: 'private',
			optin: 'single',
			status: 'active',
			description: 'New description',
			tags: [],
		});
		expect(JSON.parse(String(requests[2]?.init.body))).toEqual({
			name: 'Updated list',
			type: 'private',
			optin: 'single',
			status: 'archived',
			description: 'Preserve this description',
			tags: ['preserve', 'these'],
		});
		for (const { init } of requests) {
			const headers = new Headers(init.headers);
			expect(headers.get('accept')).toBe('application/json');
			expect(headers.get('authorization')).toBe('token admin:secret-token');
			expect(headers.get('content-type')).toBe(init.body === undefined ? null : 'application/json');
		}
	});

	it.each([400, 404])('normalizes a missing detail status %i to null', async (status) => {
		const manager = createListmonkMailingListManager(
			config,
			vi.fn(async () => json({ message: 'missing' }, status)),
		);

		await expect(manager.get(404)).resolves.toBeNull();
	});

	it('validates the delete acknowledgement', async () => {
		const manager = createListmonkMailingListManager(
			config,
			vi.fn(async () => json({ data: false })),
		);

		await expect(manager.delete(7)).rejects.toThrow('invalid deleted mailing-list response');
	});

	it('exposes diagnostic-free provider failures without normalizing other statuses to missing', async () => {
		const diagnostic = `upstream leaked ${config.LISTMONK_API_TOKEN}`;
		const manager = createListmonkMailingListManager(
			config,
			vi.fn(async () => new Response(diagnostic, { status: 502, headers: { 'content-type': 'text/plain' } })),
		);

		const error = await manager.get(7).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(MailingListProviderFailure);
		expect(error).toMatchObject({ name: 'MailingListProviderFailure', status: 502 });
		expect(String(error)).not.toContain(diagnostic);
		expect(String(error)).not.toContain(config.LISTMONK_API_TOKEN);
	});

	it.each([
		[
			'successful non-JSON',
			() => new Response('<html>proxy</html>', { headers: { 'content-type': 'text/html' } }),
			/expected JSON/,
		],
		['malformed JSON', () => new Response('{', { headers: { 'content-type': 'application/json' } }), /malformed JSON/],
		['invalid DTO', () => catalog([providerList(1, { uuid: 'not-a-uuid' })]), /invalid mailing-list catalog/],
	] as const)('fails closed for %s responses', async (_label, response, expected) => {
		const manager = createListmonkMailingListManager(config, vi.fn(async () => response()));

		await expect(manager.list()).rejects.toThrow(expected);
	});
});
