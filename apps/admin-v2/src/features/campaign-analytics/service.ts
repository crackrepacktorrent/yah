import type { Permissions } from '@yah/admin-core/permissions';
import * as v from 'valibot';
import {
	CampaignAnalyticsQuerySchema,
	type CampaignAnalyticsPoint,
	type CampaignAnalyticsQuery,
} from './contracts';
import { createPublicError } from '~/platform/errors';

export type CampaignAnalyticsReader = {
	read(query: CampaignAnalyticsQuery): Promise<CampaignAnalyticsPoint[]>;
};

export type CampaignAnalyticsServiceDependencies = {
	enforcePermissions(headers: Headers, permissions: Permissions): Promise<void>;
	reader: CampaignAnalyticsReader;
};

export async function readAuthorizedCampaignAnalytics(
	input: unknown,
	headers: Headers,
	dependencies: CampaignAnalyticsServiceDependencies,
): Promise<CampaignAnalyticsPoint[]> {
	const result = v.safeParse(CampaignAnalyticsQuerySchema, input);
	if (!result.success) {
		throw createPublicError(result.issues[0]?.message ?? 'Invalid campaign analytics query.', 400);
	}

	await dependencies.enforcePermissions(headers, { campaign: ['view'] });
	return dependencies.reader.read(result.output);
}
