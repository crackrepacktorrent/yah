import { describe, expect, it, vi } from 'vitest';
import { createListmonkBounceManager } from './bounce-manager.server';

const config = { LISTMONK_URL: 'https://mail.example/', LISTMONK_API_TOKEN: 'admin:secret-token' };

function providerBounce(id: number, overrides: Record<string, unknown> = {}) {
	return {
		id,
		type: 'hard',
		source: 'smtp',
		meta: { provider: 'listmonk' },
		created_at: new Date(Date.UTC(2026, 7, 27, 12) - id * 60_000).toISOString(),
		email: `supporter-${id}@example.test`,
		subscriber_uuid: `10000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
		subscriber_id: id + 100,
		subscriber_status: 'enabled',
		campaign: { id: 21, name: 'August supporter update' },
		...overrides,
	};
}

function json(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function catalog(
	results: unknown[],
	metadata: { page?: number; per_page?: number; total?: number; search?: string; query?: string } = {},
): Response {
	return json({
		data: {
			results,
			search: metadata.search ?? '',
			query: metadata.query ?? '',
			total: metadata.total ?? results.length,
			per_page: metadata.per_page ?? 50,
			page: metadata.page ?? 1,
		},
	});
}

describe('Listmonk bounce manager', () => {
	it('requests one bounded explicitly ordered page and normalizes the strict v6 projection', async () => {
		const request = vi.fn(async (_input: string | URL, _init: RequestInit = {}) =>
			catalog([
				providerBounce(1),
				providerBounce(2, {
					type: 'complaint',
					source: 'campaign',
					subscriber_status: 'blocklisted',
					campaign: null,
				}),
			], { total: 52 }),
		);
		const manager = createListmonkBounceManager(config, request);

		await expect(manager.list({ page: 1 })).resolves.toEqual({
			items: [
				{
					id: 1,
					type: 'hard',
					source: 'smtp',
					createdAt: '2026-08-27T11:59:00.000Z',
					email: 'supporter-1@example.test',
					campaignName: 'August supporter update',
				},
				{
					id: 2,
					type: 'complaint',
					source: 'campaign',
					createdAt: '2026-08-27T11:58:00.000Z',
					email: 'supporter-2@example.test',
					campaignName: null,
				},
			],
			total: 52,
			page: 1,
			requestedPage: 1,
			pageSize: 50,
		});

		expect(request).toHaveBeenCalledOnce();
		const firstRequest = request.mock.calls[0];
		expect(firstRequest).toBeDefined();
		if (!firstRequest) throw new Error('Expected one Listmonk request.');
		const [url, init] = firstRequest;
		expect(String(url)).toBe(
			'https://mail.example/api/bounces?page=1&per_page=50&order_by=created_at&order=desc',
		);
		expect(init?.method).toBeUndefined();
		const headers = new Headers(init?.headers);
		expect(headers.get('accept')).toBe('application/json');
		expect(headers.get('authorization')).toBe('token admin:secret-token');
	});

	it('falls back once from Listmonk’s zeroed out-of-range envelope and preserves the requested page', async () => {
		const request = vi.fn(async (input: string | URL) => {
			const page = new URL(input).searchParams.get('page');
			if (page === '9') {
				return catalog([], { page: 0, per_page: 0, total: 0 });
			}
			return catalog([providerBounce(1)], { page: 1, total: 1 });
		});
		const manager = createListmonkBounceManager(config, request);

		await expect(manager.list({ page: 9 })).resolves.toEqual(expect.objectContaining({
			page: 1,
			requestedPage: 9,
			total: 1,
			items: [expect.objectContaining({ id: 1 })],
		}));
		expect(request).toHaveBeenCalledTimes(2);
		expect(request.mock.calls.map(([url]) => new URL(url).searchParams.get('page'))).toEqual(['9', '1']);
	});

	it('normalizes Listmonk’s zeroed empty first-page envelope', async () => {
		const manager = createListmonkBounceManager(
			config,
			vi.fn(async () => catalog([], { page: 0, per_page: 0, total: 0 })),
		);

		await expect(manager.list({ page: 1 })).resolves.toEqual({
			items: [],
			total: 0,
			page: 1,
			requestedPage: 1,
			pageSize: 50,
		});
	});

	it('uses the exact subscriber-scoped read payload and path', async () => {
		const request = vi.fn(async (_input: string | URL, _init: RequestInit = {}) =>
			json({ data: [providerBounce(3, { type: 'soft' })] }),
		);
		const manager = createListmonkBounceManager(config, request);

		await expect(manager.listForSubscriber(103)).resolves.toEqual([
			expect.objectContaining({ id: 3, type: 'soft', campaignName: 'August supporter update' }),
		]);
		expect(String(request.mock.calls[0]?.[0])).toBe('https://mail.example/api/subscribers/103/bounces');
	});

	it('fails closed when a subscriber-scoped response contains another subscriber’s bounce', async () => {
		const manager = createListmonkBounceManager(
			config,
			vi.fn(async () => json({ data: [providerBounce(3, { subscriber_id: 999 })] })),
		);

		await expect(manager.listForSubscriber(103)).rejects.toThrow('another subscriber’s bounce');
	});

	it('uses repeated ID parameters and exact clear endpoints', async () => {
		const request = vi.fn(async (_input: string | URL, _init: RequestInit = {}) => json({ data: true }));
		const manager = createListmonkBounceManager(config, request);

		await manager.delete([3, 7]);
		await manager.clearAll();
		await manager.clearSubscriber(42);

		expect(request.mock.calls.map(([input, init]) => [new URL(input).pathname + new URL(input).search, init?.method]))
			.toEqual([
				['/api/bounces?id=3&id=7', 'DELETE'],
				['/api/bounces?all=true', 'DELETE'],
				['/api/subscribers/42/bounces', 'DELETE'],
			]);
	});

	it('fails closed on invalid v6 enums, legacy campaign fields, and inconsistent catalog state', async () => {
		const invalidResponses = [
			catalog([providerBounce(1, { type: 'transient' })]),
			catalog([providerBounce(1, { campaign_id: 21 })]),
			catalog([providerBounce(1, { campaign: { id: 21, name: 'Update', uuid: 'unexpected' } })]),
			catalog([providerBounce(2), providerBounce(1)]),
			catalog([providerBounce(1), providerBounce(1)]),
			catalog([providerBounce(1)], { page: 2, total: 1 }),
			catalog([], { page: 4, per_page: 50, total: 151 }),
		];

		for (const response of invalidResponses) {
			const manager = createListmonkBounceManager(config, vi.fn(async () => response));
			await expect(manager.list({ page: 1 })).rejects.toThrow();
		}
	});

	it('enforces direct-call bounds before touching the transport', async () => {
		const request = vi.fn(async () => json({ data: true }));
		const manager = createListmonkBounceManager(config, request);

		await expect(manager.list({ page: 10_001 })).rejects.toThrow('valid page');
		await expect(manager.listForSubscriber(0)).rejects.toThrow('valid subscriber ID');
		await expect(manager.delete([])).rejects.toThrow('1 to 100 unique');
		await expect(manager.delete([7, 7])).rejects.toThrow('1 to 100 unique');
		await expect(manager.delete(Array.from({ length: 101 }, (_, index) => index + 1))).rejects.toThrow(
			'1 to 100 unique',
		);
		await expect(manager.clearSubscriber(-1)).rejects.toThrow('valid subscriber ID');
		expect(request).not.toHaveBeenCalled();
	});

	it('validates delete acknowledgements and subscriber response bounds', async () => {
		const rejectedDelete = createListmonkBounceManager(config, vi.fn(async () => json({ data: false })));
		await expect(rejectedDelete.clearAll()).rejects.toThrow('invalid cleared bounce catalog response');

		const tooMany = Array.from({ length: 1_001 }, (_, index) => providerBounce(index + 1));
		const oversizedRead = createListmonkBounceManager(config, vi.fn(async () => json({ data: tooMany })));
		await expect(oversizedRead.listForSubscriber(42)).rejects.toThrow('invalid subscriber bounce catalog response');
	});
});
