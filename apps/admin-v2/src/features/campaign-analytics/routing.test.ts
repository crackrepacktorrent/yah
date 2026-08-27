import { describe, expect, it } from 'vitest';
import {
	decodeCampaignAnalyticsLocation,
	defaultCampaignAnalyticsDates,
} from './routing';

const now = new Date('2026-08-27T23:30:00-05:00');

describe('campaign analytics routing', () => {
	it('uses a stable seven-calendar-day UTC default without selecting campaigns', () => {
		expect(defaultCampaignAnalyticsDates(now)).toEqual({ from: '2026-08-22', to: '2026-08-28' });
		expect(decodeCampaignAnalyticsLocation({}, now)).toEqual({
			campaignIds: [],
			from: '2026-08-22',
			to: '2026-08-28',
			error: '',
		});
	});

	it('preserves repeated campaign parameters and explicit dates', () => {
		expect(decodeCampaignAnalyticsLocation({
			campaign: ['21', '34'],
			from: '2026-08-01',
			to: '2026-08-27',
		}, now)).toEqual({
			campaignIds: [21, 34],
			from: '2026-08-01',
			to: '2026-08-27',
			error: '',
		});
	});

	it.each([
		[{ campaign: '0' }, 'Use valid campaign and date filters.'],
		[{ campaign: ['21', '21'] }, 'Select each campaign only once.'],
		[{ campaign: Array.from({ length: 101 }, (_, index) => String(index + 1)) }, 'Select at most 100 campaigns.'],
		[{ campaign: '21', from: '2026-08-28', to: '2026-08-27' }, 'The start date must not be after the end date.'],
		[{ campaign: '21', from: '2026-02-29', to: '2026-08-27' }, 'Use a real calendar date.'],
		[{ campaign: '21', from: ['2026-08-01', '2026-08-02'], to: '2026-08-27' }, 'Use valid campaign and date filters.'],
	] as const)('returns a visible error for invalid URL filters', (query, message) => {
		expect(decodeCampaignAnalyticsLocation(query, now).error).toBe(message);
	});
});
