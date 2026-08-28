import { describe, expect, it } from 'vitest';
import { campaignAnalyticsNeedsTime, formatCampaignAnalyticsTimestamp } from './presentation';

describe('campaign analytics presentation', () => {
	it('keeps daily UTC-midnight buckets compact', () => {
		expect(campaignAnalyticsNeedsTime([
			{ timestamp: '2026-08-23T00:00:00Z' },
			{ timestamp: '2026-08-24T00:00:00.000Z' },
		])).toBe(false);
		expect(formatCampaignAnalyticsTimestamp('2026-08-23T00:00:00Z', false)).toBe('Aug 23, 2026');
	});

	it('shows UTC time for hourly buckets without browser-timezone shifts', () => {
		const points = [
			{ timestamp: '2026-08-23T01:00:00Z' },
			{ timestamp: '2026-08-23T14:00:00Z' },
		];
		expect(campaignAnalyticsNeedsTime(points)).toBe(true);
		expect(formatCampaignAnalyticsTimestamp(points[0]!.timestamp, true)).toBe('Aug 23, 2026, 1:00 AM UTC');
		expect(formatCampaignAnalyticsTimestamp('2026-08-23T00:30:00+05:00', true)).toBe('Aug 22, 2026, 7:30 PM UTC');
	});
});
