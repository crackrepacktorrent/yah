import { query } from '@solidjs/router';
import type { CampaignAnalyticsPoint, CampaignAnalyticsQuery } from './contracts';
import { readAuthorizedCampaignAnalytics } from './service';
import { runProductionRequest } from '~/platform/production-request.server';

async function requestDependencies(headers: Headers) {
	const [{ createAuthorizationContext }, { productionCampaignAnalyticsReader }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-campaign-analytics-reader.server'),
	]);
	return { authorization: createAuthorizationContext(headers), reader: productionCampaignAnalyticsReader };
}

export const getCampaignAnalytics = query(
	async (input: CampaignAnalyticsQuery): Promise<CampaignAnalyticsPoint[]> => {
		'use server';
		return runProductionRequest(async (request) =>
			readAuthorizedCampaignAnalytics(input, await requestDependencies(request.headers)),
		);
	},
	'campaign-analytics',
);
