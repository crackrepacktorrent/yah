import type { CampaignAnalyticsPoint } from './contracts';

function parsedTimestamp(timestamp: string): Date | null {
	const date = new Date(timestamp);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** Daily Listmonk buckets are UTC midnight; hourly buckets need their time shown. */
export function campaignAnalyticsNeedsTime(points: readonly Pick<CampaignAnalyticsPoint, 'timestamp'>[]): boolean {
	const days = new Set<string>();
	for (const point of points) {
		const date = parsedTimestamp(point.timestamp);
		if (!date) return true;
		const day = date.toISOString().slice(0, 10);
		if (days.has(day)) return true;
		days.add(day);
		if (date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) {
			return true;
		}
	}
	return false;
}

export function formatCampaignAnalyticsTimestamp(timestamp: string, includeTime: boolean): string {
	const date = parsedTimestamp(timestamp);
	if (!date) return timestamp;
	return new Intl.DateTimeFormat('en-US', {
		timeZone: 'UTC',
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		...(includeTime ? { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' as const } : {}),
	}).format(date);
}
