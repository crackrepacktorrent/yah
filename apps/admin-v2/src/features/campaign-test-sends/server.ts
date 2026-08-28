import type { SendCampaignTestCommand } from './contracts';
import { sendAuthorizedCampaignTest } from './service';
import { runProductionRequest } from '~/platform/production-request.server';

async function requestDependencies(headers: Headers) {
	const [{ createAuthorizationContext }, { productionCampaignTestSender }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-campaign-test-sender.server'),
	]);
	return { authorization: createAuthorizationContext(headers), sender: productionCampaignTestSender };
}

export async function sendCampaignTest(command: SendCampaignTestCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) => sendAuthorizedCampaignTest(command, await requestDependencies(request.headers)));
}
