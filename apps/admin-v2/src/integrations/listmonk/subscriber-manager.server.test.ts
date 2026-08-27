import { describe, expect, it, vi } from 'vitest';
import { SubscriberProviderFailure } from '~/features/subscribers/contracts';
import { createListmonkSubscriberManager } from './subscriber-manager.server';

const config = { LISTMONK_URL: 'https://mail.example.test/', LISTMONK_API_TOKEN: 'fixture-token' };

function json(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function providerMembership(id: number, overrides: Record<string, unknown> = {}) {
	return {
		id,
		created_at: '2026-08-20T10:00:00Z',
		updated_at: '2026-08-25T11:00:00Z',
		uuid: '00000000-0000-4000-8000-' + String(id).padStart(12, '0'),
		name: 'List ' + String(id),
		type: 'public',
		optin: 'double',
		status: 'active',
		tags: ['news'],
		description: 'Description ' + String(id),
		subscription_status: 'confirmed',
		subscription_created_at: '2026-08-21T10:00:00Z',
		subscription_updated_at: '2026-08-25T11:00:00Z',
		subscription_meta: { source: 'fixture' },
		...overrides,
	};
}

function providerSubscriber(id = 7, overrides: Record<string, unknown> = {}) {
	return {
		id,
		created_at: '2026-08-20T10:00:00Z',
		updated_at: '2026-08-26T12:00:00Z',
		uuid: '00000000-0000-4000-8000-' + String(id).padStart(12, '0'),
		email: 'person-' + String(id) + '@example.test',
		name: 'Person ' + String(id),
		status: 'enabled',
		attribs: { city: 'Austin', nested: { provider: true } },
		lists: [providerMembership(11)],
		ignored_provider_field: 'forward-compatible',
		...overrides,
	};
}

function detail(value: unknown): Response {
	return json({ data: value });
}

function catalog(results: unknown[], overrides: Record<string, unknown> = {}): Response {
	return json({
		data: {
			results,
			query: '',
			search: '',
			total: results.length,
			per_page: 50,
			page: 1,
			...overrides,
		},
	});
}

describe('Listmonk subscriber manager HTTP contract', () => {
	it('uses fixed server pagination and escapes provider regex syntax into literal search semantics', async () => {
		const escaped = 'A\\+B\\(test\\)\\[x\\]\\.';
		const request = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
			catalog([providerSubscriber()], { page: 2, search: escaped, total: 51 }),
		);
		const manager = createListmonkSubscriberManager(config, request);

		await expect(manager.list({ page: 2, search: '  A+B(test)[x].  ' })).resolves.toMatchObject({
			total: 51,
			page: 2,
			pageSize: 50,
			search: 'A+B(test)[x].',
			items: [{ id: 7, email: 'person-7@example.test' }],
		});

		const [input, init] = request.mock.calls[0]!;
		const url = new URL(input);
		expect(url.pathname).toBe('/api/subscribers');
		expect(Object.fromEntries(url.searchParams)).toEqual({ page: '2', per_page: '50', search: escaped });
		expect(url.searchParams.has('order_by')).toBe(false);
		expect(url.searchParams.has('order')).toBe(false);
		expect(url.searchParams.has('query')).toBe(false);
		expect(new Headers(init?.headers).get('authorization')).toBe('token fixture-token');
	});

	it('re-reads and returns the last real page when the requested page is now out of range', async () => {
		const requestedPages: string[] = [];
		const request = vi.fn(async (input: string | URL) => {
			const page = new URL(input).searchParams.get('page') ?? '';
			requestedPages.push(page);
			return page === '2'
				? catalog([providerSubscriber()], { page: 2, total: 51 })
				: catalog([], { page: 999, total: 51 });
		});
		await expect(createListmonkSubscriberManager(config, request).list({ page: 999, search: '' })).resolves.toMatchObject({
			page: 2,
			total: 51,
		});
		expect(requestedPages).toEqual(['999', '2']);
	});

	it('rejects pagination, SQL-query, search, and duplicate-ID response drift', async () => {
		await expect(createListmonkSubscriberManager(config, vi.fn(async () => catalog([], { per_page: 20 }))).list({ page: 1, search: '' })).rejects.toThrow('bounded subscriber page');
		await expect(createListmonkSubscriberManager(config, vi.fn(async () => catalog([], { query: 'TRUE' }))).list({ page: 1, search: '' })).rejects.toThrow('SQL query');
		await expect(createListmonkSubscriberManager(config, vi.fn(async () => catalog([], { search: 'other' }))).list({ page: 1, search: '' })).rejects.toThrow('search request');
		await expect(createListmonkSubscriberManager(config, vi.fn(async () => catalog([providerSubscriber(), providerSubscriber()], { total: 2 }))).list({ page: 1, search: '' })).rejects.toThrow('duplicate');
		await expect(createListmonkSubscriberManager(config, vi.fn(async () => catalog([providerSubscriber()], { total: 0 }))).list({ page: 1, search: '' })).rejects.toThrow('inconsistent subscriber page metadata');
	});

	it('normalizes detail, restricted memberships, attributes, and opt-in eligibility', async () => {
		const row = providerSubscriber(7, {
			lists: [
				providerMembership(11, { subscription_status: 'unconfirmed' }),
				providerMembership(12, { name: '*Unknown', restricted: true, description: undefined }),
			],
		});
		const manager = createListmonkSubscriberManager(config, vi.fn(async () => detail(row)));
		await expect(manager.get(7)).resolves.toEqual(expect.objectContaining({
			id: 7,
			attributes: { city: 'Austin', nested: { provider: true } },
			canRequestOptIn: true,
			memberships: [
				expect.objectContaining({ id: 11, status: 'unconfirmed', restricted: false }),
				expect.objectContaining({ id: 12, name: '*Unknown', description: null, restricted: true }),
			],
		}));
	});

	it.each([400, 404])('normalizes missing detail status %i to null', async (status) => {
		const missing = createListmonkSubscriberManager(config, vi.fn(async () => json({ message: 'private detail' }, status)));
		await expect(missing.get(99)).resolves.toBeNull();
	});

	it('keeps other provider failures diagnostic-free', async () => {
		const diagnostic = 'secret ' + config.LISTMONK_API_TOKEN;
		const manager = createListmonkSubscriberManager(
			config,
			vi.fn(async () => new Response(diagnostic, { status: 503, headers: { 'content-type': 'text/plain' } })),
		);
		const error = await manager.get(7).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(SubscriberProviderFailure);
		expect(error).toMatchObject({ status: 503 });
		expect(String(error)).not.toContain(diagnostic);
	});

	it('creates a mail-free identity before applying consent-safe memberships', async () => {
		const identity = providerSubscriber(8, {
			email: 'new@example.test',
			name: 'New Person',
			attribs: {},
			lists: [],
		});
		const completed = providerSubscriber(8, {
			email: 'new@example.test',
			name: 'New Person',
			attribs: {},
			lists: [
				providerMembership(11, { optin: 'single', subscription_status: 'confirmed' }),
				providerMembership(12, { optin: 'double', subscription_status: 'unconfirmed' }),
			],
		});
		const bodies: unknown[] = [];
		const request = vi.fn(async (input: string | URL, init?: RequestInit) => {
			const url = new URL(input);
			if (url.pathname === '/api/lists/11') return json({ data: { id: 11, type: 'public', optin: 'single', status: 'active' } });
			if (url.pathname === '/api/lists/12') return json({ data: { id: 12, type: 'public', optin: 'double', status: 'active' } });
			if (url.pathname === '/api/subscribers' && init?.method === 'POST') {
				bodies.push(JSON.parse(String(init.body)));
				return detail(identity);
			}
			if (url.pathname === '/api/subscribers/lists') {
				bodies.push(JSON.parse(String(init?.body)));
				return json({ data: true });
			}
			return detail(completed);
		});
		const manager = createListmonkSubscriberManager(config, request);
		await expect(manager.create({
			email: 'new@example.test',
			name: 'New Person',
			status: 'enabled',
			listIds: [11, 12],
			preconfirmSubscriptions: false,
		})).resolves.toMatchObject({ id: 8, email: 'new@example.test' });
		expect(bodies).toEqual([{
			email: 'new@example.test',
			name: 'New Person',
			status: 'enabled',
			lists: [],
			attribs: {},
			preconfirm_subscriptions: false,
		}, {
			ids: [8], target_list_ids: [11], action: 'add', status: 'confirmed',
		}, {
			ids: [8], target_list_ids: [12], action: 'add',
		}]);
		expect(request.mock.calls.some(([url]) => String(url).endsWith('/optin'))).toBe(false);
	});

	it('preconfirms both list kinds only through one explicit post-create membership add', async () => {
		const identity = providerSubscriber(8, { email: 'confirmed@example.test', name: '', attribs: {}, lists: [] });
		const completed = providerSubscriber(8, {
			email: 'confirmed@example.test',
			name: '',
			attribs: {},
			lists: [
				providerMembership(11, { optin: 'single', subscription_status: 'confirmed' }),
				providerMembership(12, { optin: 'double', subscription_status: 'confirmed' }),
			],
		});
		const bodies: unknown[] = [];
		const request = vi.fn(async (input: string | URL, init?: RequestInit) => {
			const url = new URL(input);
			if (url.pathname === '/api/lists/11') return json({ data: { id: 11, type: 'public', optin: 'single', status: 'active' } });
			if (url.pathname === '/api/lists/12') return json({ data: { id: 12, type: 'public', optin: 'double', status: 'active' } });
			if (url.pathname === '/api/subscribers' && init?.method === 'POST') {
				bodies.push(JSON.parse(String(init.body)));
				return detail(identity);
			}
			if (url.pathname === '/api/subscribers/lists') {
				bodies.push(JSON.parse(String(init?.body)));
				return json({ data: true });
			}
			return detail(completed);
		});
		await createListmonkSubscriberManager(config, request).create({
			email: 'confirmed@example.test', name: '', status: 'enabled', listIds: [11, 12], preconfirmSubscriptions: true,
		});
		expect(bodies).toEqual([
			{ email: 'confirmed@example.test', name: '', status: 'enabled', lists: [], attribs: {}, preconfirm_subscriptions: false },
			{ ids: [8], target_list_ids: [11, 12], action: 'add', status: 'confirmed' },
		]);
	});

	it('rejects a newly double-opt-in target for a disabled identity before POST', async () => {
		let identityPosts = 0;
		const request = vi.fn(async (input: string | URL, init?: RequestInit) => {
			const url = new URL(input);
			if (url.pathname === '/api/lists/12') {
				return json({ data: { id: 12, type: 'public', optin: 'double', status: 'active' } });
			}
			if (url.pathname === '/api/subscribers' && init?.method === 'POST') identityPosts += 1;
			return detail(providerSubscriber(8, { email: 'disabled@example.test', status: 'disabled', lists: [] }));
		});
		const manager = createListmonkSubscriberManager(config, request);
		await expect(manager.create({
			email: 'disabled@example.test',
			name: '',
			status: 'disabled',
			listIds: [12],
			preconfirmSubscriptions: false,
		})).rejects.toMatchObject({ name: 'SubscriberProviderFailure', status: 422 });
		expect(identityPosts).toBe(0);
	});

	it('marks any post-create acknowledgement, membership, or verification failure as partial', async () => {
		const malformedIdentity = createListmonkSubscriberManager(config, vi.fn(async (input, init) => {
			const url = new URL(input);
			if (url.pathname === '/api/lists/11') return json({ data: { id: 11, type: 'public', optin: 'single', status: 'active' } });
			if (init?.method === 'POST') return detail(providerSubscriber(8, { email: 'wrong@example.test', lists: [] }));
			return json({ data: true });
		}));
		await expect(malformedIdentity.create({
			email: 'new@example.test',
			name: '',
			status: 'enabled',
			listIds: [11],
			preconfirmSubscriptions: false,
		})).rejects.toMatchObject({ name: 'SubscriberPartialMutationFailure' });

		let identityCreated = false;
		const failedMembership = createListmonkSubscriberManager(config, vi.fn(async (input, init) => {
			const url = new URL(input);
			if (url.pathname === '/api/lists/11') return json({ data: { id: 11, type: 'public', optin: 'single', status: 'active' } });
			if (init?.method === 'POST') {
				identityCreated = true;
				return detail(providerSubscriber(8, { email: 'new@example.test', name: '', attribs: {}, lists: [] }));
			}
			return json({ message: 'failed' }, 500);
		}));
		await expect(failedMembership.create({
			email: 'new@example.test', name: '', status: 'enabled', listIds: [11], preconfirmSubscriptions: false,
		})).rejects.toMatchObject({ name: 'SubscriberPartialMutationFailure' });
		expect(identityCreated).toBe(true);

		let mutations = 0;
		const failedVerification = createListmonkSubscriberManager(config, vi.fn(async (input, init) => {
			const url = new URL(input);
			if (url.pathname === '/api/lists/11') return json({ data: { id: 11, type: 'public', optin: 'single', status: 'active' } });
			if (init?.method === 'POST') return detail(providerSubscriber(8, { email: 'new@example.test', name: '', attribs: {}, lists: [] }));
			if (url.pathname === '/api/subscribers/lists') {
				mutations += 1;
				return json({ data: true });
			}
			return detail(providerSubscriber(8, { email: 'new@example.test', name: '', attribs: {}, lists: [] }));
		}));
		await expect(failedVerification.create({
			email: 'new@example.test', name: '', status: 'enabled', listIds: [11], preconfirmSubscriptions: false,
		})).rejects.toMatchObject({ name: 'SubscriberPartialMutationFailure' });
		expect(mutations).toBe(1);
	});

	it('keeps definite create rejection distinct but treats ambiguous POST failure as partial', async () => {
		for (const status of [409, 422]) {
			const manager = createListmonkSubscriberManager(config, vi.fn(async (input, init) => {
				const url = new URL(input);
				if (url.pathname === '/api/lists/11') return json({ data: { id: 11, type: 'public', optin: 'single', status: 'active' } });
				if (init?.method === 'POST') return json({ message: 'rejected' }, status);
				return json({ data: true });
			}));
			await expect(manager.create({
				email: 'new@example.test', name: '', status: 'enabled', listIds: [11], preconfirmSubscriptions: false,
			})).rejects.toMatchObject({ name: 'SubscriberProviderFailure', status });
		}

		const ambiguous = createListmonkSubscriberManager(config, vi.fn(async (input, init) => {
			const url = new URL(input);
			if (url.pathname === '/api/lists/11') return json({ data: { id: 11, type: 'public', optin: 'single', status: 'active' } });
			if (init?.method === 'POST') return json({ message: 'unknown result' }, 503);
			return json({ data: true });
		}));
		await expect(ambiguous.create({
			email: 'new@example.test', name: '', status: 'enabled', listIds: [11], preconfirmSubscriptions: false,
		})).rejects.toMatchObject({ name: 'SubscriberPartialMutationFailure' });
	});

	it('re-reads before profile PUT and preserves every current membership plus attributes', async () => {
		const current = providerSubscriber(7, {
			lists: [
				providerMembership(11),
				providerMembership(13, { name: '*Unknown', restricted: true, description: undefined }),
				providerMembership(14, { status: 'archived' }),
				providerMembership(15, { type: 'temporary' }),
				providerMembership(16, { subscription_status: 'unsubscribed' }),
			],
		});
		const updated = providerSubscriber(7, {
			email: 'changed@example.test',
			name: 'Changed',
			lists: [
				providerMembership(11),
				providerMembership(13, { name: '*Unknown', restricted: true, description: undefined }),
				providerMembership(14, { status: 'archived' }),
				providerMembership(15, { type: 'temporary' }),
				providerMembership(16, { subscription_status: 'unsubscribed' }),
			],
		});
		const request = vi.fn(async (_input: string | URL, init?: RequestInit) =>
			init?.method === 'PUT' ? detail(updated) : detail(current),
		);
		const manager = createListmonkSubscriberManager(config, request);
		await manager.updateProfile({
			id: 7,
			expectedUpdatedAt: '2026-08-26T12:00:00Z',
			email: 'changed@example.test',
			name: 'Changed',
			status: 'enabled',
		});

		expect(request).toHaveBeenCalledTimes(2);
		const [url, init] = request.mock.calls[1]!;
		expect(url).toBe('https://mail.example.test/api/subscribers/7');
		expect(init?.method).toBe('PUT');
		expect(JSON.parse(String(init?.body))).toEqual({
			email: 'changed@example.test',
			name: 'Changed',
			status: 'enabled',
			lists: [11, 13, 14, 15, 16],
			attribs: { city: 'Austin', nested: { provider: true } },
			preconfirm_subscriptions: false,
		});
	});

	it('rejects a stale full PUT before mutation', async () => {
		const request = vi.fn(async () => detail(providerSubscriber()));
		const manager = createListmonkSubscriberManager(config, request);
		await expect(manager.updateProfile({
			id: 7,
			expectedUpdatedAt: '2026-08-25T12:00:00Z',
			email: 'person-7@example.test',
			name: 'Person 7',
			status: 'enabled',
		})).rejects.toMatchObject({ name: 'SubscriberProviderFailure', status: 409 });
		expect(request).toHaveBeenCalledTimes(1);
	});

	it('refuses full PUT when a retained pending double-opt-in membership could trigger implicit mail', async () => {
		const request = vi.fn(async () => detail(providerSubscriber(7, {
			lists: [providerMembership(11, { subscription_status: 'unconfirmed', optin: 'double' })],
		})));
		const manager = createListmonkSubscriberManager(config, request);
		await expect(manager.updateProfile({
			id: 7,
			expectedUpdatedAt: '2026-08-26T12:00:00Z',
			email: 'person-7@example.test',
			name: 'Person 7',
			status: 'enabled',
		})).rejects.toMatchObject({ name: 'SubscriberProviderFailure', status: 409 });
		expect(request).toHaveBeenCalledTimes(1);
	});

	it('applies a versioned membership diff with consent-safe statuses and no opt-in call', async () => {
		const current = providerSubscriber(7, {
			lists: [
				providerMembership(11),
				providerMembership(16, { subscription_status: 'unsubscribed' }),
			],
		});
		const updated = providerSubscriber(7, {
			lists: [
				providerMembership(11, { subscription_status: 'unsubscribed' }),
				providerMembership(12, { optin: 'single', subscription_status: 'confirmed' }),
				providerMembership(13, { type: 'private', optin: 'double', subscription_status: 'unconfirmed' }),
				providerMembership(16, { subscription_status: 'unsubscribed' }),
			],
		});
		let mutations = 0;
		const bodies: unknown[] = [];
		const request = vi.fn(async (input: string | URL, init?: RequestInit) => {
			const url = new URL(input);
			if (url.pathname === '/api/lists/12') return json({ data: { id: 12, type: 'public', optin: 'single', status: 'active' } });
			if (url.pathname === '/api/lists/13') return json({ data: { id: 13, type: 'private', optin: 'double', status: 'active' } });
			if (url.pathname === '/api/subscribers/lists') {
				mutations += 1;
				bodies.push(JSON.parse(String(init?.body)));
				return json({ data: true });
			}
			return detail(mutations === 3 ? updated : current);
		});
		const manager = createListmonkSubscriberManager(config, request);
		const before = await manager.get(7);
		if (!before) throw new Error('Expected subscriber fixture.');
		await expect(manager.updateMemberships({
			id: 7,
			expectedUpdatedAt: before.updatedAt,
			expectedMembershipVersion: before.membershipVersion,
			listIds: [12, 13],
		})).resolves.toMatchObject({
			memberships: [
				expect.objectContaining({ id: 11, status: 'unsubscribed' }),
				expect.objectContaining({ id: 12, status: 'confirmed' }),
				expect.objectContaining({ id: 13, status: 'unconfirmed' }),
				expect.objectContaining({ id: 16, status: 'unsubscribed' }),
			],
		});
		expect(bodies).toEqual([
			{ ids: [7], target_list_ids: [12], action: 'add', status: 'confirmed' },
			{ ids: [7], target_list_ids: [13], action: 'add' },
			{ ids: [7], target_list_ids: [11], action: 'unsubscribe' },
		]);
		expect(request.mock.calls.some(([url]) => String(url).endsWith('/optin'))).toBe(false);
	});

	it('detects membership-only staleness before any list mutation', async () => {
		const request = vi.fn(async () => detail(providerSubscriber()));
		const manager = createListmonkSubscriberManager(config, request);
		await expect(manager.updateMemberships({
			id: 7,
			expectedUpdatedAt: '2026-08-26T12:00:00Z',
			expectedMembershipVersion: `smv1-${'b'.repeat(43)}`,
			listIds: [11],
		})).rejects.toMatchObject({ name: 'SubscriberProviderFailure', status: 409 });
		expect(request).toHaveBeenCalledTimes(1);
	});

	it('rechecks membership version after target validation and performs zero stale mutations', async () => {
		const current = providerSubscriber(7, { lists: [] });
		const changed = providerSubscriber(7, { lists: [providerMembership(99)] });
		let changedDuringValidation = false;
		let mutations = 0;
		const request = vi.fn(async (input: string | URL) => {
			const url = new URL(input);
			if (url.pathname === '/api/lists/12') {
				changedDuringValidation = true;
				return json({ data: { id: 12, type: 'public', optin: 'single', status: 'active' } });
			}
			if (url.pathname === '/api/subscribers/lists') {
				mutations += 1;
				return json({ data: true });
			}
			return detail(changedDuringValidation ? changed : current);
		});
		const manager = createListmonkSubscriberManager(config, request);
		const before = await manager.get(7);
		if (!before) throw new Error('Expected subscriber fixture.');
		await expect(manager.updateMemberships({
			id: 7,
			expectedUpdatedAt: before.updatedAt,
			expectedMembershipVersion: before.membershipVersion,
			listIds: [12],
		})).rejects.toMatchObject({ name: 'SubscriberProviderFailure', status: 409 });
		expect(mutations).toBe(0);
	});

	it('surfaces a visibly partial result if a later membership-diff call fails', async () => {
		const current = providerSubscriber(7, { lists: [] });
		let mutation = 0;
		const request = vi.fn(async (input: string | URL) => {
			const url = new URL(input);
			if (url.pathname === '/api/lists/12') return json({ data: { id: 12, type: 'public', optin: 'single', status: 'active' } });
			if (url.pathname === '/api/lists/13') return json({ data: { id: 13, type: 'private', optin: 'double', status: 'active' } });
			if (url.pathname === '/api/subscribers/lists') {
				mutation += 1;
				return mutation === 1 ? json({ data: true }) : json({ message: 'failed' }, 500);
			}
			return detail(current);
		});
		const manager = createListmonkSubscriberManager(config, request);
		const before = await manager.get(7);
		if (!before) throw new Error('Expected subscriber fixture.');
		await expect(manager.updateMemberships({
			id: 7,
			expectedUpdatedAt: before.updatedAt,
			expectedMembershipVersion: before.membershipVersion,
			listIds: [12, 13],
		})).rejects.toMatchObject({ name: 'SubscriberPartialMutationFailure' });
		expect(mutation).toBe(2);
	});

	it('preflights and post-verifies bulk deletion', async () => {
		let deleted = false;
		const request = vi.fn(async (_input: string | URL, init?: RequestInit) => {
			if (init?.method === 'DELETE') {
				deleted = true;
				return json({ data: true });
			}
			return deleted ? json({ message: 'missing' }, 400) : detail(providerSubscriber());
		});
		const manager = createListmonkSubscriberManager(config, request);
		await manager.delete([{ id: 7, expectedUpdatedAt: '2026-08-26T12:00:00Z' }]);
		expect(request).toHaveBeenCalledTimes(3);
		expect(request.mock.calls[1]?.[0]).toBe('https://mail.example.test/api/subscribers?id=7');

		const noOp = createListmonkSubscriberManager(config, vi.fn(async (_input, init) =>
			init?.method === 'DELETE' ? json({ data: true }) : detail(providerSubscriber()),
		));
		await expect(noOp.delete([{ id: 7, expectedUpdatedAt: '2026-08-26T12:00:00Z' }])).rejects.toThrow('without deleting');
	});

	it('preflights and verifies blocklist status plus every subscription effect', async () => {
		let blocked = false;
		const request = vi.fn(async (_input: string | URL, init?: RequestInit) => {
			if (init?.method === 'PUT') {
				blocked = true;
				return json({ data: true });
			}
			return detail(providerSubscriber(7, blocked ? {
				status: 'blocklisted',
				lists: [providerMembership(11, { subscription_status: 'unsubscribed' })],
			} : {}));
		});
		const manager = createListmonkSubscriberManager(config, request);
		await manager.blocklist([{ id: 7, expectedUpdatedAt: '2026-08-26T12:00:00Z' }]);
		const [url, init] = request.mock.calls[1]!;
		expect(url).toBe('https://mail.example.test/api/subscribers/blocklist');
		expect(JSON.parse(String(init?.body))).toEqual({ ids: [7] });

		const incomplete = createListmonkSubscriberManager(config, vi.fn(async (_input, init) =>
			init?.method === 'PUT' ? json({ data: true }) : detail(providerSubscriber()),
		));
		await expect(incomplete.blocklist([{ id: 7, expectedUpdatedAt: '2026-08-26T12:00:00Z' }])).rejects.toThrow('complete subscription effect');
	});

	it('parses the actual activity endpoint after proving the subscriber exists', async () => {
		const request = vi.fn(async (input: string | URL) => String(input).endsWith('/activity')
			? json({ data: {
				campaign_views: [{
					id: 21,
					uuid: '00000000-0000-4000-8000-000000000021',
					name: 'August update',
					subject: 'August news',
					view_count: 3,
					last_viewed_at: '2026-08-26T12:00:00Z',
				}],
				link_clicks: [{
					link_id: 31,
					url: 'https://example.test/story',
					campaign_id: null,
					campaign_uuid: null,
					campaign_name: null,
					campaign_subject: null,
					click_count: 2,
					last_clicked_at: '2026-08-26T13:00:00Z',
				}],
			} })
			: detail(providerSubscriber()));
		const manager = createListmonkSubscriberManager(config, request);
		await expect(manager.activity(7)).resolves.toEqual({
			campaignViews: [expect.objectContaining({ campaignId: 21, viewCount: 3 })],
			linkClicks: [expect.objectContaining({ linkId: 31, campaignId: null, clickCount: 2 })],
		});
		expect(request).toHaveBeenCalledTimes(2);

		const missingRequest = vi.fn(async () => json({ message: 'missing' }, 400));
		await expect(createListmonkSubscriberManager(config, missingRequest).activity(99)).resolves.toBeNull();
		expect(missingRequest).toHaveBeenCalledTimes(1);
	});

	it('fails closed when activity exceeds its explicit bound', async () => {
		const views = Array.from({ length: 1_001 }, (_, index) => ({
			id: index + 1,
			uuid: '00000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
			name: 'Campaign',
			subject: 'Subject',
			view_count: 1,
			last_viewed_at: '2026-08-26T12:00:00Z',
		}));
		const request = vi.fn(async (input: string | URL) => String(input).endsWith('/activity')
			? json({ data: { campaign_views: views, link_clicks: [] } })
			: detail(providerSubscriber()));
		await expect(createListmonkSubscriberManager(config, request).activity(7)).rejects.toThrow('invalid subscriber activity');
	});

	it('supports an explicit mocked opt-in request', async () => {
		const eligible = providerSubscriber(7, {
			lists: [providerMembership(11, { subscription_status: 'unconfirmed', optin: 'double' })],
		});
		const optInRequest = vi.fn(async (_input: string | URL, init?: RequestInit) =>
			init?.method === 'POST' ? json({ data: true }) : detail(eligible),
		);
		const optInManager = createListmonkSubscriberManager(config, optInRequest);
		const optInSubscriber = await optInManager.get(7);
		if (!optInSubscriber) throw new Error('Expected eligible subscriber fixture.');
		optInRequest.mockClear();
		await optInManager.requestOptIn({
			id: 7,
			expectedUpdatedAt: '2026-08-26T12:00:00Z',
			expectedMembershipVersion: optInSubscriber.membershipVersion,
		});
		const [url, init] = optInRequest.mock.calls[1]!;
		expect(url).toBe('https://mail.example.test/api/subscribers/7/optin');
		expect(init?.method).toBe('POST');
		expect(init?.body).toBeUndefined();
	});

	it('fails closed for malformed DTOs and acknowledgements', async () => {
		await expect(createListmonkSubscriberManager(config, vi.fn(async () =>
			detail(providerSubscriber(7, { status: 'mystery' })),
		)).get(7)).rejects.toThrow('invalid subscriber detail');
		const invalidAcknowledgement = vi.fn(async (_input: string | URL, init?: RequestInit) =>
			init?.method === 'POST'
				? json({ data: false })
				: detail(providerSubscriber(7, {
					lists: [providerMembership(11, { subscription_status: 'unconfirmed', optin: 'double' })],
				})),
		);
		const invalidManager = createListmonkSubscriberManager(config, invalidAcknowledgement);
		const invalidSubscriber = await invalidManager.get(7);
		if (!invalidSubscriber) throw new Error('Expected eligible subscriber fixture.');
		await expect(invalidManager.requestOptIn({
			id: 7,
			expectedUpdatedAt: '2026-08-26T12:00:00Z',
			expectedMembershipVersion: invalidSubscriber.membershipVersion,
		})).rejects.toMatchObject({ name: 'SubscriberAmbiguousOptInFailure' });

		for (const status of [422, 503]) {
			const request = vi.fn(async (_input: string | URL, init?: RequestInit) =>
				init?.method === 'POST' ? json({ message: 'provider result' }, status) : detail(providerSubscriber(7, {
					lists: [providerMembership(11, { subscription_status: 'unconfirmed', optin: 'double' })],
				})),
			);
			const manager = createListmonkSubscriberManager(config, request);
			const current = await manager.get(7);
			if (!current) throw new Error('Expected eligible subscriber fixture.');
			const result = manager.requestOptIn({
				id: 7,
				expectedUpdatedAt: current.updatedAt,
				expectedMembershipVersion: current.membershipVersion,
			});
			if (status < 500) await expect(result).rejects.toMatchObject({ name: 'SubscriberProviderFailure', status });
			else await expect(result).rejects.toMatchObject({ name: 'SubscriberAmbiguousOptInFailure' });
		}
	});
});
