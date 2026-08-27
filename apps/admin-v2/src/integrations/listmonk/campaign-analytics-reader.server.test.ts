import { describe, expect, it, vi } from 'vitest';
import type { CampaignAnalyticsQuery } from '~/features/campaign-analytics/contracts';
import { createListmonkCampaignAnalyticsReader } from './campaign-analytics-reader.server';

const config = { LISTMONK_URL: 'https://mail.example/', LISTMONK_API_TOKEN: 'admin:secret-token' };
const validQuery: CampaignAnalyticsQuery = {
	campaignIds: [11, 7],
	metric: 'views',
	from: '2026-08-01',
	to: '2026-08-27',
};

function json(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

function providerPoint(campaignId: number, count: number, timestamp: string) {
	return { campaign_id: campaignId, count, timestamp };
}

describe('Listmonk campaign analytics reader', () => {
	it('checks v6.2 compatibility, then makes one authenticated GET with repeated IDs and inclusive UTC bounds', async () => {
		const request = vi.fn(async (input: string | URL, _init: RequestInit = {}) =>
			String(input).endsWith('/api/config')
				? json({ data: { version: 'v6.2.0', unrelated: true } })
				: json({ data: [providerPoint(11, 3, '2026-08-01T00:00:00Z')] }),
		);
		const reader = createListmonkCampaignAnalyticsReader(config, request);

		await reader.read(validQuery);

		expect(request).toHaveBeenCalledTimes(2);
		const configRequest = request.mock.calls[0];
		const analyticsRequest = request.mock.calls[1];
		expect(configRequest).toBeDefined();
		expect(analyticsRequest).toBeDefined();
		if (!configRequest || !analyticsRequest) throw new Error('Expected config and analytics requests.');
		expect(String(configRequest[0])).toBe('https://mail.example/api/config');
		const [input, init] = analyticsRequest;
		expect(String(input)).toBe(
			'https://mail.example/api/campaigns/analytics/views?id=11&id=7&from=2026-08-01T00%3A00%3A00.000Z&to=2026-08-27T23%3A59%3A59.999999Z',
		);
		expect(init?.method).toBeUndefined();
		for (const call of [configRequest, analyticsRequest]) {
			const headers = new Headers(call[1]?.headers);
			expect(headers.get('accept')).toBe('application/json');
			expect(headers.get('authorization')).toBe('token admin:secret-token');
		}
	});

	it('shares one compatibility check across concurrent metric reads', async () => {
		const request = vi.fn(async (input: string | URL) =>
			String(input).endsWith('/api/config')
				? json({ data: { version: 'v6.9.1' } })
				: json({ data: [] }),
		);
		const reader = createListmonkCampaignAnalyticsReader(config, request);

		await Promise.all([
			reader.read(validQuery),
			reader.read({ ...validQuery, metric: 'clicks' }),
		]);

		expect(request).toHaveBeenCalledTimes(3);
		expect(request.mock.calls.filter(([input]) => String(input).endsWith('/api/config'))).toHaveLength(1);
	});

	it.each(['v6.0.0', 'v6.1.9', 'v6.2.0-nightly', 'v6.02.0', `v6.${'9'.repeat(400)}.0`, 'v7.0.0', '6.2.0'])('fails closed for unsupported declared version %s', async (version) => {
		const request = vi.fn(async () => json({ data: { version } }));
		const reader = createListmonkCampaignAnalyticsReader(config, request);

		await expect(reader.read(validQuery)).rejects.toThrow('requires an official stable Listmonk v6.2');
		expect(request).toHaveBeenCalledOnce();
	});

	it('normalizes and orders rows by timestamp and then campaign ID', async () => {
		const request = vi.fn(async (input: string | URL) => String(input).endsWith('/api/config')
			? json({ data: { version: 'v6.2.0' } })
			: json({
				data: [
					providerPoint(11, 8, '2026-08-03T12:00:00Z'),
					providerPoint(11, 5, '2026-08-01T08:00:00-05:00'),
					providerPoint(7, 3, '2026-08-01T13:00:00Z'),
				],
			}));
		const reader = createListmonkCampaignAnalyticsReader(config, request);

		await expect(reader.read(validQuery)).resolves.toEqual([
			{ campaignId: 7, count: 3, timestamp: '2026-08-01T13:00:00Z' },
			{ campaignId: 11, count: 5, timestamp: '2026-08-01T08:00:00-05:00' },
			{ campaignId: 11, count: 8, timestamp: '2026-08-03T12:00:00Z' },
		]);
		expect(request).toHaveBeenCalledTimes(2);
	});

	it('fails closed on an unrequested campaign or duplicate campaign timestamp bucket', async () => {
		const invalidResponses = [
			{ data: [providerPoint(99, 1, '2026-08-01T00:00:00Z')] },
			{
				data: [
					providerPoint(7, 1, '2026-08-01T00:00:00Z'),
					providerPoint(7, 2, '2026-08-01T00:00:00Z'),
				],
			},
		];

		for (const response of invalidResponses) {
			const reader = createListmonkCampaignAnalyticsReader(
				config,
				vi.fn(async (input) => String(input).endsWith('/api/config')
					? json({ data: { version: 'v6.2.0' } })
					: json(response)),
			);
			await expect(reader.read(validQuery)).rejects.toThrow();
		}
	});

	it('strictly rejects malformed provider envelopes, rows, timestamps, and unsafe counts', async () => {
		const valid = providerPoint(7, 1, '2026-08-01T00:00:00Z');
		const invalidResponses = [
			[valid],
			{ data: [valid], unexpected: true },
			{ data: [{ ...valid, unexpected: true }] },
			{ data: [{ ...valid, campaign_id: 0 }] },
			{ data: [{ ...valid, count: Number.MAX_SAFE_INTEGER + 1 }] },
			{ data: [{ ...valid, timestamp: '2026-13-01T00:00:00Z' }] },
			{ data: [{ ...valid, timestamp: '2026-02-30T00:00:00Z' }] },
			{ data: [{ ...valid, timestamp: '2026-08-01T00:00:00' }] },
		];

		for (const response of invalidResponses) {
			const reader = createListmonkCampaignAnalyticsReader(
				config,
				vi.fn(async (input) => String(input).endsWith('/api/config')
					? json({ data: { version: 'v6.2.0' } })
					: json(response)),
			);
			await expect(reader.read(validQuery)).rejects.toThrow(
				'Listmonk returned an invalid campaign analytics response',
			);
		}
	});

	it('rejects invalid direct-call queries without touching the transport', async () => {
		const request = vi.fn(async () => json({ data: [] }));
		const reader = createListmonkCampaignAnalyticsReader(config, request);
		const invalidQueries: unknown[] = [
			{ ...validQuery, campaignIds: [] },
			{ ...validQuery, campaignIds: [7, 7] },
			{ ...validQuery, campaignIds: [Number.MAX_SAFE_INTEGER + 1] },
			{ ...validQuery, from: '2026-08-28', to: '2026-08-27' },
			{ ...validQuery, metric: 'opens' },
		];

		for (const input of invalidQueries) {
			await expect(reader.read(input as CampaignAnalyticsQuery)).rejects.toThrow(
				'Listmonk campaign analytics requires a valid bounded query',
			);
		}
		expect(request).not.toHaveBeenCalled();
	});
});
