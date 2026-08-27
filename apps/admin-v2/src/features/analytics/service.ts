import type { Permissions } from '@yah/admin-core/permissions';
import * as v from 'valibot';
import { ANALYTICS_PERIODS, type AnalyticsPeriod, type AnalyticsSnapshot, type SiteOverview } from './contracts';
import { createPublicError } from '~/platform/errors';

const periodSchema = v.picklist(ANALYTICS_PERIODS);

export type AnalyticsReader = {
	getSnapshot(period: AnalyticsPeriod): Promise<AnalyticsSnapshot>;
};

export type AnalyticsServiceDependencies = {
	enforcePermissions(headers: Headers, permissions: Permissions): Promise<void>;
	reader: AnalyticsReader;
};

/** Validate, authorize, and only then cross the provider boundary. */
export async function readAuthorizedAnalytics(
	input: unknown,
	headers: Headers,
	dependencies: AnalyticsServiceDependencies,
): Promise<AnalyticsSnapshot> {
	const result = v.safeParse(periodSchema, input);
	if (!result.success) throw createPublicError('Invalid analytics period.', 400);

	await dependencies.enforcePermissions(headers, { analytics: ['view'] });
	return dependencies.reader.getSnapshot(result.output);
}

export async function readAuthorizedSiteOverview(
	headers: Headers,
	dependencies: {
		enforcePermissions(headers: Headers, permissions: Permissions): Promise<void>;
		reader: { getOverview(): Promise<SiteOverview> };
	},
): Promise<SiteOverview> {
	await dependencies.enforcePermissions(headers, { analytics: ['view'] });
	return dependencies.reader.getOverview();
}
