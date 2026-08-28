import 'server-only';
import type { AuthorizationContext } from '~/platform/auth/authorization-context';
import { createPublicInputParser } from '~/platform/public-input';
import {
	CampaignAnalyticsQuerySchema,
	type CampaignAnalyticsPoint,
	type CampaignAnalyticsQuery,
} from './contracts';

export type CampaignAnalyticsReader = {
	read(query: CampaignAnalyticsQuery): Promise<CampaignAnalyticsPoint[]>;
};

export type CampaignAnalyticsServiceDependencies = {
	authorization: AuthorizationContext;
	reader: CampaignAnalyticsReader;
};
const parse = createPublicInputParser('Invalid campaign analytics query.');

export async function readAuthorizedCampaignAnalytics(
	input: unknown,
	dependencies: CampaignAnalyticsServiceDependencies,
): Promise<CampaignAnalyticsPoint[]> {
	const query = parse(CampaignAnalyticsQuerySchema, input);

	await dependencies.authorization.requirePermissions({ campaign: ['view'] });
	return dependencies.reader.read(query);
}
