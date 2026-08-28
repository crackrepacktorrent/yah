import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import {
	CampaignAnalyticsInputSchema,
	CreateCampaignInputSchema,
	CreateShortUrlInputSchema,
	EmailSettingsPatchSchema,
} from './admin-contracts';

describe('admin command schemas', () => {
	test('rejects non-http shortlink destinations', () => {
		const result = v.safeParse(CreateShortUrlInputSchema, {
			longUrl: 'javascript:alert(1)',
			tags: [],
			maxVisits: null,
			crawlable: false,
			forwardQuery: true,
		});

		expect(result.success).toBe(false);
	});

	test('requires a campaign audience', () => {
		const result = v.safeParse(CreateCampaignInputSchema, {
			name: 'Newsletter',
			subject: 'August update',
			lists: [],
		});

		expect(result.success).toBe(false);
	});

	test('deduplicates repeated campaign IDs before fan-out', () => {
		const result = v.parse(CampaignAnalyticsInputSchema, {
			campaignIds: [7, 7, 9],
			type: 'views',
			from: '2026-01-01T00:00:00.000Z',
			to: '2026-01-02T00:00:00.000Z',
		});
		expect(result.campaignIds).toEqual([7, 9]);
	});

	test('rejects reversed analytics ranges', () => {
		const result = v.safeParse(CampaignAnalyticsInputSchema, {
			campaignIds: [1],
			type: 'views',
			from: '2026-08-26T00:00:00Z',
			to: '2026-08-25T00:00:00Z',
		});

		expect(result.success).toBe(false);
	});

	test('allows known settings and rejects arbitrary keys', () => {
		expect(v.safeParse(EmailSettingsPatchSchema, { 'app.site_name': 'YAH' }).success).toBe(true);
		expect(v.safeParse(EmailSettingsPatchSchema, { 'database.password': 'leak' }).success).toBe(false);
	});
});
