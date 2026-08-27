import { describe, expect, it, vi } from 'vitest';
import { ShortlinkProviderFailure } from '~/features/shortlinks/contracts';
import { createShlinkShortlinkManager } from './shortlink-manager.server';

const config = { SHLINK_URL: 'https://links.example/', SHLINK_API_KEY: ' exact api key ' };
const pagination = { currentPage: 1, pagesCount: 1, itemsPerPage: 10_000, itemsInCurrentPage: 1, totalItems: 1 };
const providerShortlink = {
	shortCode: 'press kit',
	shortUrl: 'https://y4h.org/press%20kit',
	longUrl: 'https://example.test/press',
	dateCreated: '2026-08-26T12:00:00Z',
	title: 'Press kit',
	tags: ['press'],
	crawlable: false,
	forwardQuery: true,
	hasRedirectRules: false,
	domain: null,
	visitsSummary: { total: 4, nonBots: 3, bots: 1 },
	meta: { validSince: null, validUntil: null, maxVisits: null },
};

function json(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

describe('Shlink shortlink manager', () => {
	it('uses exact list and detail protocols and returns normalized DTOs', async () => {
		const requests: Array<{ url: URL; init?: RequestInit }> = [];
		const request = vi.fn(async (input: string | URL, init?: RequestInit) => {
			const url = new URL(input);
			requests.push({ url, init });
			if (url.pathname.endsWith('/visits')) {
				return json({
					visits: {
						data: [
							{
								referer: '',
								date: '2026-08-26T12:30:00Z',
								userAgent: 'Fixture Browser',
								potentialBot: false,
								visitedUrl: null,
								redirectUrl: null,
								visitLocation: { cityName: 'Austin', countryCode: 'US', countryName: 'United States', extra: true },
							},
						],
						pagination: { ...pagination, itemsPerPage: 20 },
					},
				});
			}
			if (url.pathname.endsWith('/short-urls/press%20kit')) return json(providerShortlink);
			return json({ shortUrls: { data: [providerShortlink], pagination } });
		});
		const manager = createShlinkShortlinkManager(config, request);

		await expect(manager.list()).resolves.toEqual([
			expect.objectContaining({ shortCode: 'press kit', visits: { total: 4, nonBots: 3, bots: 1 }, maxVisits: null }),
		]);
		await expect(manager.getEditable('press kit')).resolves.toEqual({
			shortCode: 'press kit',
			longUrl: 'https://example.test/press',
			title: 'Press kit',
			tags: ['press'],
			crawlable: false,
			forwardQuery: true,
			maxVisits: null,
			validUntil: null,
		});
		await expect(manager.getDetail('press kit')).resolves.toEqual({
			shortlink: expect.objectContaining({ shortCode: 'press kit' }),
			recentVisits: [
				{
					referer: '',
					date: '2026-08-26T12:30:00Z',
					userAgent: 'Fixture Browser',
					location: { city: 'Austin', countryCode: 'US', country: 'United States' },
				},
			],
			totalVisits: 1,
		});

		expect(requests[0]?.url.pathname).toBe('/rest/v3/short-urls');
		expect(requests[0]?.url.searchParams.get('itemsPerPage')).toBe('10000');
		expect(requests[0]?.url.searchParams.get('orderBy')).toBe('dateCreated-DESC');
		expect(requests[1]?.url.pathname).toBe('/rest/v3/short-urls/press%20kit');
		expect(requests[2]?.url.pathname).toBe('/rest/v3/short-urls/press%20kit');
		expect(requests[3]?.url.searchParams.get('excludeBots')).toBe('true');
		expect(requests[3]?.url.searchParams.get('itemsPerPage')).toBe('20');
		for (const { init } of requests) {
			expect(init?.headers).toMatchObject({ Accept: 'application/json', 'X-Api-Key': config.SHLINK_API_KEY });
		}
	});

	it('sends strict create/edit/reset/delete bodies and methods', async () => {
		const requests: Array<{ url: URL; init?: RequestInit }> = [];
		const request = vi.fn(async (input: string | URL, init?: RequestInit) => {
			requests.push({ url: new URL(input), init });
			if (init?.method === 'DELETE' && new URL(input).pathname.endsWith('/visits')) return json({ deletedVisits: 7 });
			if (init?.method === 'DELETE') return new Response(null, { status: 204 });
			return json(providerShortlink);
		});
		const manager = createShlinkShortlinkManager(config, request);
		const command = {
			longUrl: 'https://example.test/press',
			customSlug: 'press kit',
			title: '',
			tags: [],
			maxVisits: null,
			validUntil: undefined,
			crawlable: false,
			forwardQuery: true,
		};

		await manager.create(command);
		await manager.edit({ ...command, shortCode: 'press kit' });
		await expect(manager.resetVisits('press kit')).resolves.toEqual({ deletedCount: 7 });
		await manager.delete('press kit');

		expect(requests.map(({ init }) => init?.method)).toEqual(['POST', 'PATCH', 'DELETE', 'DELETE']);
		expect(requests.map(({ url }) => url.pathname)).toEqual([
			'/rest/v3/short-urls',
			'/rest/v3/short-urls/press%20kit',
			'/rest/v3/short-urls/press%20kit/visits',
			'/rest/v3/short-urls/press%20kit',
		]);
		expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
			longUrl: command.longUrl,
			customSlug: command.customSlug,
			maxVisits: null,
			crawlable: false,
			forwardQuery: true,
		});
		expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({
			longUrl: command.longUrl,
			title: null,
			tags: [],
			maxVisits: null,
			validUntil: null,
			crawlable: false,
			forwardQuery: true,
		});
	});

	it('normalizes 404, rejects incomplete lists, and hides upstream diagnostics', async () => {
		const missing = createShlinkShortlinkManager(config, vi.fn(async () => json({ detail: 'missing' }, 404)));
		await expect(missing.getEditable('missing')).resolves.toBeNull();

		const incomplete = createShlinkShortlinkManager(
			config,
			vi.fn(async () => json({ shortUrls: { data: [providerShortlink], pagination: { ...pagination, pagesCount: 2, totalItems: 10_001 } } })),
		);
		await expect(incomplete.list()).rejects.toThrow('10,000-link safety cap');

		const secretBody = `provider diagnostic ${config.SHLINK_API_KEY}`;
		const failing = createShlinkShortlinkManager(
			config,
			vi.fn(async () => new Response(secretBody, { status: 502, headers: { 'content-type': 'text/plain' } })),
		);
		const error = await failing.list().catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(ShortlinkProviderFailure);
		expect(String(error)).not.toContain(secretBody);
		expect(String(error)).not.toContain(config.SHLINK_API_KEY);
	});

	it('preserves only the allowlisted duplicate-slug problem type', async () => {
		const diagnostic = `duplicate ${config.SHLINK_API_KEY}`;
		const manager = createShlinkShortlinkManager(
			config,
			vi.fn(async () => json({
				type: 'https://shlink.io/api/error/non-unique-slug',
				title: 'Invalid custom slug',
				detail: diagnostic,
				status: 400,
			}, 400)),
		);
		const error = await manager.create({
			longUrl: 'https://example.test',
			customSlug: 'press-kit',
			title: '',
			tags: [],
			maxVisits: null,
			crawlable: false,
			forwardQuery: true,
		}).catch((caught: unknown) => caught);
		expect(error).toMatchObject({ status: 400, problemType: 'non-unique-slug' });
		expect(String(error)).not.toContain(diagnostic);
		expect(String(error)).not.toContain(config.SHLINK_API_KEY);
	});

	it.each([
		['HTML success', () => new Response('<html>oops</html>', { headers: { 'content-type': 'text/html' } }), /expected JSON/],
		['malformed JSON', () => new Response('{', { headers: { 'content-type': 'application/json' } }), /malformed JSON/],
		['invalid DTO', () => json({ shortUrls: { data: [{ shortCode: 42 }], pagination } }), /invalid shortlink-list/],
	] as const)('fails closed for %s', async (_label, response, expected) => {
		const manager = createShlinkShortlinkManager(config, vi.fn(async () => response()));
		await expect(manager.list()).rejects.toThrow(expected);
	});

	it('fails closed instead of dropping custom-domain identity from route and mutation targets', async () => {
		const manager = createShlinkShortlinkManager(
			config,
			vi.fn(async () => json({
				shortUrls: {
					data: [{ ...providerShortlink, domain: 'alternate.example.test' }],
					pagination,
				},
			})),
		);
		await expect(manager.list()).rejects.toThrow('custom-domain shortlinks are not supported');
	});

	it('fails closed instead of hiding redirect-rule behavior from operators', async () => {
		const manager = createShlinkShortlinkManager(
			config,
			vi.fn(async () => json({
				shortUrls: {
					data: [{ ...providerShortlink, hasRedirectRules: true }],
					pagination,
				},
			})),
		);
		await expect(manager.list()).rejects.toThrow('redirect-rule shortlinks are not supported');
	});
});
