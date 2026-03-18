import { query } from '$app/server';
import * as v from 'valibot';
import {
	getWebsiteStats,
	getPageviews,
	getMetrics,
	getActiveVisitors,
	type UmamiStats,
} from '$lib/server/umami';

function bounceRate(stats: UmamiStats): number {
	return stats.visits > 0 ? Math.round((stats.bounces / stats.visits) * 100) : 0;
}

function avgVisitTime(stats: UmamiStats): number {
	return stats.visits > 0 ? Math.round(stats.totaltime / stats.visits) : 0;
}

export const getSiteStats = query(async () => {
	const now = Date.now();
	const oneDayAgo = now - 24 * 60 * 60 * 1000;
	const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

	const [today, month] = await Promise.all([
		getWebsiteStats(oneDayAgo, now),
		getWebsiteStats(thirtyDaysAgo, now),
	]);

	return {
		today: {
			pageviews: today.pageviews,
			visitors: today.visitors,
			visits: today.visits,
			bounceRate: bounceRate(today),
			avgTime: avgVisitTime(today),
		},
		month: {
			pageviews: month.pageviews,
			visitors: month.visitors,
			visits: month.visits,
			bounceRate: bounceRate(month),
			avgTime: avgVisitTime(month),
		},
	};
});

export const getAnalytics = query(
	v.object({
		period: v.optional(v.picklist(['24h', '7d', '30d']), '7d'),
	}),
	async ({ period }) => {
		const now = Date.now();
		const ranges: Record<string, { startAt: number; unit: 'hour' | 'day' }> = {
			'24h': { startAt: now - 24 * 60 * 60 * 1000, unit: 'hour' },
			'7d': { startAt: now - 7 * 24 * 60 * 60 * 1000, unit: 'day' },
			'30d': { startAt: now - 30 * 24 * 60 * 60 * 1000, unit: 'day' },
		};

		const { startAt, unit } = ranges[period];

		const [stats, pageviews, pages, referrers, browsers, os, devices, countries, active] =
			await Promise.all([
				getWebsiteStats(startAt, now),
				getPageviews(startAt, now, unit),
				getMetrics(startAt, now, 'path', 10),
				getMetrics(startAt, now, 'referrer', 10),
				getMetrics(startAt, now, 'browser', 5),
				getMetrics(startAt, now, 'os', 5),
				getMetrics(startAt, now, 'device', 5),
				getMetrics(startAt, now, 'country', 10),
				getActiveVisitors(),
			]);

		return {
			stats: {
				pageviews: stats.pageviews,
				visitors: stats.visitors,
				visits: stats.visits,
				bounceRate: bounceRate(stats),
				avgTime: avgVisitTime(stats),
			},
			pageviews: pageviews.pageviews,
			sessions: pageviews.sessions,
			pages,
			referrers,
			browsers,
			os,
			devices,
			countries,
			active,
		};
	},
);
