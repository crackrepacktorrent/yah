import type { SendCampaignTestCommand } from './contracts';
import { sendAuthorizedCampaignTest } from './service';
import { surfaceError } from '~/platform/errors';
import { getServerRequest } from '~/platform/request';
import { requireProductionRuntime } from '~/platform/runtime.server';

async function dependencies() {
	const [{ enforcePermissions }, { productionCampaignTestSender }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-campaign-test-sender.server'),
	]);
	return { enforcePermissions, sender: productionCampaignTestSender };
}

export async function sendCampaignTest(command: SendCampaignTestCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await sendAuthorizedCampaignTest(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}
