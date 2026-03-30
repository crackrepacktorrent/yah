import { query } from '@solidjs/router';
import { getShlink } from '~/server/shlink';
import { getWebsiteStats, bounceRate, avgVisitTime } from '~/server/umami';
import { withPermissions } from '~/server/auth-helpers';

export const getDashboard = query(async () => {
	'use server';
	return withPermissions({ shortlink: ['view'] }, async () => {
		const shlink = getShlink();
		const [shortUrlsRes, overallVisitsRes] = await Promise.all([
			shlink.listShortUrls({ itemsPerPage: 5, orderBy: 'dateCreated-DESC' }),
			shlink.getOverallVisits(),
		]);
		return {
			recentShortUrls: shortUrlsRes.shortUrls.data,
			totalShortUrls: shortUrlsRes.shortUrls.pagination.totalItems,
			visits: overallVisitsRes.visits,
		};
	});
}, 'getDashboard');

export const getSiteStats = query(async () => {
	'use server';
	return withPermissions({ analytics: ['view'] }, async () => {
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
				bounceRate: bounceRate(today),
				avgTime: avgVisitTime(today),
			},
			month: {
				pageviews: month.pageviews,
				visitors: month.visitors,
				bounceRate: bounceRate(month),
				avgTime: avgVisitTime(month),
			},
		};
	});
}, 'getSiteStats');
