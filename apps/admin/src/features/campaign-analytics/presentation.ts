import type { CampaignAnalyticsQuery } from './contracts';

/** Listmonk 6.2 uses hourly buckets for ranges shorter than seven elapsed days. */
export function campaignAnalyticsInterval(selection: Pick<CampaignAnalyticsQuery, 'from' | 'to'>): 'hour' | 'day' {
	// The inclusive final day ends just before midnight: seven calendar dates
	// are still less than seven elapsed days; eight calendar dates use days.
	return Date.parse(selection.to) - Date.parse(selection.from) >= 7 * 24 * 60 * 60 * 1000 ? 'day' : 'hour';
}
