import 'server-only';
import type { AuthorizationContext } from '~/platform/auth/authorization-context';
import * as v from 'valibot';
import { ANALYTICS_PERIODS, type AnalyticsPeriod, type AnalyticsSnapshot, type SiteOverview } from './contracts';
import { createPublicError } from '~/platform/errors';

const periodSchema = v.picklist(ANALYTICS_PERIODS);

export type AnalyticsReader = {
	getSnapshot(period: AnalyticsPeriod): Promise<AnalyticsSnapshot>;
};

export type AnalyticsServiceDependencies = {
	authorization: AuthorizationContext;
	reader: AnalyticsReader;
};

/** Validate, authorize, and only then cross the provider boundary. */
export async function readAuthorizedAnalytics(
	input: unknown,
	dependencies: AnalyticsServiceDependencies,
): Promise<AnalyticsSnapshot> {
	const result = v.safeParse(periodSchema, input);
	if (!result.success) throw createPublicError('Invalid analytics period.', 400);

	await dependencies.authorization.requirePermissions({ analytics: ['view'] });
	return dependencies.reader.getSnapshot(result.output);
}

export async function readAuthorizedSiteOverview(
	dependencies: {
		authorization: AuthorizationContext;
		reader: { getOverview(): Promise<SiteOverview> };
	},
): Promise<SiteOverview> {
	await dependencies.authorization.requirePermissions({ analytics: ['view'] });
	return dependencies.reader.getOverview();
}
