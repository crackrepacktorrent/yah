import { query } from '@solidjs/router';
import type { CampaignAnalyticsPoint, CampaignAnalyticsQuery } from './contracts';
import { readAuthorizedCampaignAnalytics } from './service';
import { surfaceError } from '~/platform/errors';
import { getServerRequest } from '~/platform/request';
import { requireProductionRuntime } from '~/platform/runtime.server';

async function dependencies() {
	const [{ enforcePermissions }, { productionCampaignAnalyticsReader }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-campaign-analytics-reader.server'),
	]);
	return { enforcePermissions, reader: productionCampaignAnalyticsReader };
}

export const getCampaignAnalytics = query(
	async (input: CampaignAnalyticsQuery): Promise<CampaignAnalyticsPoint[]> => {
		'use server';
		const request = getServerRequest();
		try {
			requireProductionRuntime();
			return await readAuthorizedCampaignAnalytics(input, request.headers, await dependencies());
		} catch (error) {
			surfaceError(error);
		}
	},
	'campaign-analytics',
);
