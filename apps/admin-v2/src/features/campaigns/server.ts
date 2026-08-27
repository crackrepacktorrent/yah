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
import { surfaceError } from '~/platform/errors';
import { getServerRequest } from '~/platform/request';
import { requireProductionRuntime } from '~/platform/runtime.server';

async function dependencies() {
	const [{ enforcePermissions }, { productionCampaignManager }, { productionMailingListManager }, { productionEmailTemplateManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-campaign-manager.server'),
		import('~/integrations/listmonk/production-mailing-list-manager.server'),
		import('~/integrations/listmonk/production-template-manager.server'),
	]);
	return {
		enforcePermissions,
		manager: productionCampaignManager,
		mailingLists: productionMailingListManager,
		templates: productionEmailTemplateManager,
	};
}

export const listCampaigns = query(async (): Promise<CampaignSummary[]> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await listAuthorizedCampaigns(request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'campaigns');

export const getCampaign = query(async (id: number): Promise<CampaignDetail> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await readAuthorizedCampaign(id, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'campaign');

export const requireCampaignCapability = query(async (capability: CampaignCapability): Promise<true> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await requireAuthorizedCampaignCapability(capability, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'campaign-capability');

export const previewCampaign = query(async (id: number): Promise<string> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await previewAuthorizedCampaign(id, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'campaign-preview');

export async function createCampaign(command: CreateCampaignCommand): Promise<{ id: number }> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await createAuthorizedCampaign(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function updateCampaign(command: UpdateCampaignCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await updateAuthorizedCampaign(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function deleteCampaigns(command: DeleteCampaignsCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await deleteAuthorizedCampaigns(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function transitionCampaign(command: TransitionCampaignCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await transitionAuthorizedCampaign(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}
