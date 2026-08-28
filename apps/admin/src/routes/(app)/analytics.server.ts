import { query } from '@solidjs/router';
import { getWebsiteStats, getPageviews, getMetrics, getActiveVisitors, bounceRate, avgVisitTime } from '~/server/umami';
import { withPermissions } from '~/server/auth-helpers';
import { AnalyticsPeriodSchema } from '~/lib/admin-contracts';
import { parseInput } from '~/server/validation';

export const getAnalytics = query(async (period: '24h' | '7d' | '30d' = '7d') => {
	'use server';
	return withPermissions({ analytics: ['view'] }, async () => {
		const validatedPeriod = parseInput(AnalyticsPeriodSchema, period);
		const now = Date.now();
		const ranges: Record<typeof validatedPeriod, { startAt: number; unit: 'hour' | 'day' }> = {
			'24h': { startAt: now - 24 * 60 * 60 * 1000, unit: 'hour' },
			'7d': { startAt: now - 7 * 24 * 60 * 60 * 1000, unit: 'day' },
			'30d': { startAt: now - 30 * 24 * 60 * 60 * 1000, unit: 'day' },
		};
		const { startAt, unit } = ranges[validatedPeriod];

		const [stats, pageviews, pages, referrers, browsers, os, devices, cities, active] = await Promise.all([
			getWebsiteStats(startAt, now),
			getPageviews(startAt, now, unit),
			getMetrics(startAt, now, 'path', 10),
			getMetrics(startAt, now, 'referrer', 10),
			getMetrics(startAt, now, 'browser', 5),
			getMetrics(startAt, now, 'os', 5),
			getMetrics(startAt, now, 'device', 5),
			getMetrics(startAt, now, 'city', 15),
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
			pages,
			referrers,
			browsers,
			os,
			devices,
			cities,
			active,
		};
	});
}, 'getAnalytics');
