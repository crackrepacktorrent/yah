import { query } from '@solidjs/router';
import type { AnalyticsPeriod, AnalyticsSnapshot, SiteOverview } from './contracts';
import { readAuthorizedAnalytics, readAuthorizedSiteOverview } from './service';
import { surfaceError } from '~/platform/errors';
import { getServerRequest } from '~/platform/request';
import { requireProductionRuntime } from '~/platform/runtime.server';

export const getAnalytics = query(async (input: AnalyticsPeriod = '7d'): Promise<AnalyticsSnapshot> => {
	'use server';
	const request = getServerRequest();

	try {
		requireProductionRuntime();
		const [{ enforcePermissions }, { productionUmamiAnalyticsReader }] = await Promise.all([
			import('~/platform/auth/authorization.server'),
			import('~/integrations/umami/production-reader.server'),
		]);
		return await readAuthorizedAnalytics(input, request.headers, {
			enforcePermissions,
			reader: productionUmamiAnalyticsReader,
		});
	} catch (error) {
		surfaceError(error);
	}
}, 'analytics');

export const getSiteOverview = query(async (): Promise<SiteOverview> => {
	'use server';
	const request = getServerRequest();

	try {
		requireProductionRuntime();
		const [{ enforcePermissions }, { productionUmamiAnalyticsReader }] = await Promise.all([
			import('~/platform/auth/authorization.server'),
			import('~/integrations/umami/production-reader.server'),
		]);
		return await readAuthorizedSiteOverview(request.headers, {
			enforcePermissions,
			reader: productionUmamiAnalyticsReader,
		});
	} catch (error) {
		surfaceError(error);
	}
}, 'site-overview');
