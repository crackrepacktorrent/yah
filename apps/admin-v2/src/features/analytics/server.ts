import { query } from '@solidjs/router';
import type { AnalyticsPeriod, AnalyticsSnapshot, SiteOverview } from './contracts';
import { readAuthorizedAnalytics, readAuthorizedSiteOverview } from './service';
import { runProductionRequest } from '~/platform/production-request.server';

async function requestDependencies(headers: Headers) {
	const [{ createAuthorizationContext }, { productionUmamiAnalyticsReader }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/umami/production-reader.server'),
	]);
	return {
		authorization: createAuthorizationContext(headers),
		reader: productionUmamiAnalyticsReader,
	};
}

export const getAnalytics = query(async (input: AnalyticsPeriod = '7d'): Promise<AnalyticsSnapshot> => {
	'use server';
	return runProductionRequest(async (request) =>
		readAuthorizedAnalytics(input, await requestDependencies(request.headers)),
	);
}, 'analytics');

export const getSiteOverview = query(async (): Promise<SiteOverview> => {
	'use server';
	return runProductionRequest(async (request) =>
		readAuthorizedSiteOverview(await requestDependencies(request.headers)),
	);
}, 'site-overview');
