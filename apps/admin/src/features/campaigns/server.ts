import { query } from '@solidjs/router';
import type {
	CampaignCapability,
	CampaignDetail,
	CampaignSummary,
	CreateCampaignCommand,
	DeleteCampaignsCommand,
	TransitionCampaignCommand,
	UpdateCampaignCommand,
} from './contracts';
import {
	createAuthorizedCampaign,
	deleteAuthorizedCampaigns,
	listAuthorizedCampaigns,
	previewAuthorizedCampaign,
	readAuthorizedCampaign,
	requireAuthorizedCampaignCapability,
	transitionAuthorizedCampaign,
	updateAuthorizedCampaign,
} from './service';
import { runProductionRequest } from '~/platform/production-request.server';

async function requestDependencies(headers: Headers) {
	const [{ createAuthorizationContext }, { productionCampaignManager }, { productionMailingListManager }, { productionEmailTemplateManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-campaign-manager.server'),
		import('~/integrations/listmonk/production-mailing-list-manager.server'),
		import('~/integrations/listmonk/production-template-manager.server'),
	]);
	return {
		authorization: createAuthorizationContext(headers),
		manager: productionCampaignManager,
		mailingLists: productionMailingListManager,
		templates: productionEmailTemplateManager,
	};
}

export const listCampaigns = query(async (): Promise<CampaignSummary[]> => {
	'use server';
	return runProductionRequest(async (request) => listAuthorizedCampaigns(await requestDependencies(request.headers)));
}, 'campaigns');

export const getCampaign = query(async (id: number): Promise<CampaignDetail> => {
	'use server';
	return runProductionRequest(async (request) => readAuthorizedCampaign(id, await requestDependencies(request.headers)));
}, 'campaign');

export const requireCampaignCapability = query(async (capability: CampaignCapability): Promise<true> => {
	'use server';
	return runProductionRequest(async (request) =>
		requireAuthorizedCampaignCapability(capability, await requestDependencies(request.headers)),
	);
}, 'campaign-capability');

export const previewCampaign = query(async (id: number): Promise<string> => {
	'use server';
	return runProductionRequest(async (request) => previewAuthorizedCampaign(id, await requestDependencies(request.headers)));
}, 'campaign-preview');

export async function createCampaign(command: CreateCampaignCommand): Promise<{ id: number }> {
	'use server';
	return runProductionRequest(async (request) => createAuthorizedCampaign(command, await requestDependencies(request.headers)));
}

export async function updateCampaign(command: UpdateCampaignCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) => updateAuthorizedCampaign(command, await requestDependencies(request.headers)));
}

export async function deleteCampaigns(command: DeleteCampaignsCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) => deleteAuthorizedCampaigns(command, await requestDependencies(request.headers)));
}

export async function transitionCampaign(command: TransitionCampaignCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) => transitionAuthorizedCampaign(command, await requestDependencies(request.headers)));
}
