import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import {
	aggregateCampaignAnalyticsByTimestamp,
	CampaignAnalyticsPointsSchema,
	CampaignAnalyticsQuerySchema,
	MAX_CAMPAIGN_ANALYTICS_IDS,
	MAX_CAMPAIGN_ANALYTICS_POINTS,
} from './contracts';

function query(overrides: Record<string, unknown> = {}) {
	return {
		campaignIds: [7, 11],
		metric: 'views',
		from: '2025-01-01',
		to: '2026-01-02',
		...overrides,
	};
}

function point(campaignId: number, count: number, timestamp: string) {
	return { campaignId, count, timestamp };
}

describe('campaign analytics contracts', () => {
	it('accepts real dates and the inclusive 366-day difference boundary', () => {
		expect(v.safeParse(CampaignAnalyticsQuerySchema, query()).success).toBe(true);
		expect(v.safeParse(CampaignAnalyticsQuerySchema, query({
			from: '2024-02-29',
			to: '2024-02-29',
		})).success).toBe(true);
	});

	it('rejects impossible dates, reversed dates, and endpoints over 366 days apart', () => {
		const invalidQueries = [
			query({ from: '2025-02-29', to: '2025-03-01' }),
			query({ from: '2026-04-31', to: '2026-05-01' }),
			query({ from: '2026-01-02', to: '2026-01-01' }),
			query({ from: '2025-01-01', to: '2026-01-03' }),
		];

		for (const input of invalidQueries) {
			expect(v.safeParse(CampaignAnalyticsQuerySchema, input).success).toBe(false);
		}
	});

	it('requires one to 100 unique safe positive campaign IDs and a strict metric', () => {
		expect(v.safeParse(CampaignAnalyticsQuerySchema, query({
			campaignIds: Array.from({ length: MAX_CAMPAIGN_ANALYTICS_IDS }, (_, index) => index + 1),
			metric: 'clicks',
		})).success).toBe(true);

		const invalidQueries = [
			query({ campaignIds: [] }),
			query({ campaignIds: [7, 7] }),
			query({ campaignIds: [0] }),
			query({ campaignIds: [Number.MAX_SAFE_INTEGER + 1] }),
			query({ campaignIds: Array.from({ length: MAX_CAMPAIGN_ANALYTICS_IDS + 1 }, (_, index) => index + 1) }),
			query({ metric: 'opens' }),
			{ ...query(), unexpected: true },
		];

		for (const input of invalidQueries) {
			expect(v.safeParse(CampaignAnalyticsQuerySchema, input).success).toBe(false);
		}
	});

	it('strictly bounds provider points and rejects unsafe counts', () => {
		const valid = point(1, Number.MAX_SAFE_INTEGER, '2026-01-01T00:00:00Z');
		expect(v.safeParse(CampaignAnalyticsPointsSchema, [valid]).success).toBe(true);

		const invalidCollections = [
			[point(1, Number.MAX_SAFE_INTEGER + 1, '2026-01-01T00:00:00Z')],
			[point(1, -1, '2026-01-01T00:00:00Z')],
			[point(1, 1, '2026-02-30T00:00:00Z')],
			[{ ...valid, unexpected: true }],
			Array.from({ length: MAX_CAMPAIGN_ANALYTICS_POINTS + 1 }, () => valid),
		];

		for (const input of invalidCollections) {
			expect(v.safeParse(CampaignAnalyticsPointsSchema, input).success).toBe(false);
		}
	});

	it('aggregates matching timestamps and orders buckets chronologically', () => {
		expect(aggregateCampaignAnalyticsByTimestamp([
			point(2, 5, '2026-08-03T10:00:00+02:00'),
			point(1, 3, '2026-08-01T08:00:00Z'),
			point(3, 7, '2026-08-03T10:00:00+02:00'),
		])).toEqual([
			{ timestamp: '2026-08-01T08:00:00Z', count: 3 },
			{ timestamp: '2026-08-03T10:00:00+02:00', count: 12 },
		]);
	});

	it('fails rather than overflowing an aggregate beyond the safe integer limit', () => {
		expect(() => aggregateCampaignAnalyticsByTimestamp([
			point(1, Number.MAX_SAFE_INTEGER, '2026-08-01T00:00:00Z'),
			point(2, 1, '2026-08-01T00:00:00Z'),
		])).toThrow('safe integer limit');
	});
});
