import { describe, expect, it } from 'vitest';
import { campaignAnalyticsInterval } from './presentation';

describe('campaign analytics presentation', () => {
	it.each([
		['2026-08-23', '2026-08-23', 'hour'],
		['2026-08-23', '2026-08-24', 'hour'],
		['2026-08-20', '2026-08-26', 'hour'],
		['2026-08-20', '2026-08-27', 'day'],
	] as const)('matches Listmonk buckets for the inclusive range %s to %s', (from, to, interval) => {
		expect(campaignAnalyticsInterval({ from, to })).toBe(interval);
	});
});
