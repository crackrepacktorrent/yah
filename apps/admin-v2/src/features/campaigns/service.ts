import type { Permissions } from '@yah/admin-core/permissions';
import * as v from 'valibot';
import {
	CampaignCapabilitySchema,
	CampaignIdSchema,
	CreateCampaignCommandSchema,
	DeleteCampaignsCommandSchema,
	TransitionCampaignCommandSchema,
	UpdateCampaignCommandSchema,
	isCampaignProviderFailure,
	type AuthorableCampaignContentType,
	type CampaignCapability,
	type CampaignDetail,
	type CampaignSummary,
	type CreateCampaignCommand,
	type DeleteCampaignsCommand,
	type TransitionCampaignCommand,
	type UpdateCampaignCommand,
} from './contracts';
import { createPublicError } from '~/platform/errors';

export type CampaignManager = {
	list(): Promise<CampaignSummary[]>;
	get(id: number): Promise<CampaignDetail | null>;
	create(input: {
		type: 'regular' | 'optin';
		name: string;
		subject: string;
		fromEmail: string;
		listIds: number[];
		body: string;
		contentType: AuthorableCampaignContentType;
		templateId: number | null;
		tags: string[];
		sendAt: string | null;
	}): Promise<CampaignDetail>;
	update(input: {
		id: number;
		expectedUpdatedAt: string;
		name: string;
		subject: string;
		fromEmail: string;
		listIds: number[];
		body: string;
		contentType: AuthorableCampaignContentType;
		templateId: number | null;
		tags: string[];
		sendAt: string | null;
	}): Promise<CampaignDetail>;
	delete(ids: number[]): Promise<void>;
	transition(id: number, status: 'draft' | 'scheduled' | 'running' | 'paused' | 'cancelled'): Promise<CampaignDetail>;
	preview(id: number): Promise<string>;
};

type MailingListCatalog = {
	list(): Promise<Array<{ id: number; name: string; status: 'active' | 'archived'; optIn: 'single' | 'double' }>>;
};

type TemplateCatalog = {
	get(id: number): Promise<{ kind: 'tx' | 'campaign' | 'campaign_visual' } | null>;
};

export type CampaignServiceDependencies = {
	enforcePermissions(headers: Headers, permissions: Permissions): Promise<void>;
	manager: CampaignManager;
	mailingLists: MailingListCatalog;
	templates: TemplateCatalog;
};

function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
	schema: TSchema,
	input: unknown,
): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, input);
	if (!result.success) throw createPublicError(result.issues[0]?.message ?? 'Invalid campaign data.', 400);
	return result.output;
}

function notFound(): never {
	throw createPublicError('Campaign not found.', 404);
}

function requireCurrentVersion(campaign: CampaignSummary, expectedUpdatedAt: string): void {
	if (campaign.updatedAt !== expectedUpdatedAt) {
		throw createPublicError('This campaign changed after you opened it. Refresh and try again.', 409);
	}
}

function requireFutureSendAt(sendAt: string | null): void {
	if (sendAt !== null && Date.parse(sendAt) <= Date.now()) {
		throw createPublicError('Choose a scheduled time in the future.', 400);
	}
}

function requireRegularContent(type: 'regular' | 'optin', body: string): void {
	if (type === 'regular' && body.trim().length === 0) {
		throw createPublicError('Enter campaign content.', 400);
	}
}

async function authorize(
	headers: Headers,
	capability: CampaignCapability,
	dependencies: CampaignServiceDependencies,
): Promise<void> {
	await dependencies.enforcePermissions(headers, { campaign: [capability] });
}

async function authorizeAuthoring(
	headers: Headers,
	capability: 'create' | 'edit',
	dependencies: CampaignServiceDependencies,
): Promise<void> {
	await dependencies.enforcePermissions(headers, { campaign: [capability], list: ['view'] });
}

async function requireValidTargets(
	listIds: number[],
	type: 'regular' | 'optin',
	dependencies: CampaignServiceDependencies,
): Promise<void> {
	const catalog = new Map((await dependencies.mailingLists.list()).map((list) => [list.id, list]));
	const selected = listIds.map((id) => catalog.get(id));
	if (selected.some((list) => !list)) {
		throw createPublicError('One or more selected mailing lists no longer exist. Refresh and try again.', 409);
	}
	if (selected.some((list) => list?.status !== 'active')) {
		throw createPublicError('Campaigns can target only active mailing lists.', 409);
	}
	if (type === 'optin' && selected.some((list) => list?.optIn !== 'double')) {
		throw createPublicError('Confirmation campaigns can target only double opt-in mailing lists.', 409);
	}
}

async function requireValidTemplate(templateId: number | null, dependencies: CampaignServiceDependencies): Promise<void> {
	if (templateId === null) return;
	const template = await dependencies.templates.get(templateId);
	if (!template) throw createPublicError('The selected email template no longer exists. Refresh and try again.', 409);
	if (template.kind !== 'campaign') {
		throw createPublicError('Select an ordinary campaign email template.', 400);
	}
}

function surfaceProviderFailure(error: unknown, operation: 'create' | 'change' | 'preview'): never {
	if (isCampaignProviderFailure(error) && error.status === 404) notFound();
	if (isCampaignProviderFailure(error) && [400, 409, 422].includes(error.status)) {
		if (operation === 'create') throw createPublicError('Listmonk rejected these campaign settings.', 400);
		if (operation === 'preview') throw createPublicError('Listmonk could not render this campaign preview.', 400);
		throw createPublicError('Listmonk rejected the campaign change. Refresh and verify its current status.', 409);
	}
	throw error;
}

export async function requireAuthorizedCampaignCapability(
	input: unknown,
	headers: Headers,
	dependencies: CampaignServiceDependencies,
): Promise<true> {
	const capability = parse(CampaignCapabilitySchema, input);
	await authorize(headers, capability, dependencies);
	return true;
}

export async function listAuthorizedCampaigns(
	headers: Headers,
	dependencies: CampaignServiceDependencies,
): Promise<CampaignSummary[]> {
	await authorize(headers, 'view', dependencies);
	return dependencies.manager.list();
}

export async function readAuthorizedCampaign(
	input: unknown,
	headers: Headers,
	dependencies: CampaignServiceDependencies,
): Promise<CampaignDetail> {
	const id = parse(CampaignIdSchema, input);
	await authorize(headers, 'view', dependencies);
	return (await dependencies.manager.get(id)) ?? notFound();
}

export async function createAuthorizedCampaign(
	input: CreateCampaignCommand,
	headers: Headers,
	dependencies: CampaignServiceDependencies,
): Promise<{ id: number }> {
	const command = parse(CreateCampaignCommandSchema, input);
	await authorizeAuthoring(headers, 'create', dependencies);
	if (command.templateId !== null) await dependencies.enforcePermissions(headers, { template: ['view'] });
	requireRegularContent(command.type, command.body);
	requireFutureSendAt(command.sendAt);
	await Promise.all([
		requireValidTargets(command.listIds, command.type, dependencies),
		requireValidTemplate(command.templateId, dependencies),
	]);
	try {
		const created = await dependencies.manager.create({
			...command,
			body: command.type === 'optin' ? '' : command.body,
			contentType: command.type === 'optin' ? 'richtext' : command.contentType,
		});
		return { id: created.id };
	} catch (error) {
		surfaceProviderFailure(error, 'create');
	}
}

export async function updateAuthorizedCampaign(
	input: UpdateCampaignCommand,
	headers: Headers,
	dependencies: CampaignServiceDependencies,
): Promise<void> {
	const command = parse(UpdateCampaignCommandSchema, input);
	await authorizeAuthoring(headers, 'edit', dependencies);
	const current = (await dependencies.manager.get(command.id)) ?? notFound();
	requireCurrentVersion(current, command.expectedUpdatedAt);
	if (current.status !== 'draft') throw createPublicError('Only draft campaigns can be edited.', 409);
	if (current.contentType === 'visual') {
		throw createPublicError('Visual campaign content must be edited with Listmonk’s compatible visual editor.', 409);
	}
	requireRegularContent(current.type, command.body);
	requireFutureSendAt(command.sendAt);
	const templateChanged = command.templateId !== current.templateId;
	if (templateChanged && command.templateId !== null) {
		await dependencies.enforcePermissions(headers, { template: ['view'] });
	}
	await Promise.all([
		requireValidTargets(command.listIds, current.type, dependencies),
		templateChanged ? requireValidTemplate(command.templateId, dependencies) : Promise.resolve(),
	]);
	try {
		await dependencies.manager.update({
			id: current.id,
			expectedUpdatedAt: current.updatedAt,
			name: command.name,
			subject: command.subject,
			fromEmail: command.fromEmail,
			listIds: command.listIds,
			body: current.type === 'optin' ? current.body : command.body,
			contentType: current.type === 'optin' ? 'richtext' : command.contentType,
			templateId: command.templateId,
			tags: command.tags,
			sendAt: command.sendAt,
		});
	} catch (error) {
		surfaceProviderFailure(error, 'change');
	}
}

export async function deleteAuthorizedCampaigns(
	input: DeleteCampaignsCommand,
	headers: Headers,
	dependencies: CampaignServiceDependencies,
): Promise<void> {
	const command = parse(DeleteCampaignsCommandSchema, input);
	await authorize(headers, 'delete', dependencies);
	const catalog = new Map((await dependencies.manager.list()).map((campaign) => [campaign.id, campaign]));
	for (const requested of command.campaigns) {
		const current = catalog.get(requested.id) ?? notFound();
		requireCurrentVersion(current, requested.expectedUpdatedAt);
		if (current.status !== 'draft') throw createPublicError('Only draft campaigns can be deleted.', 409);
	}
	try {
		await dependencies.manager.delete(command.campaigns.map((campaign) => campaign.id));
	} catch (error) {
		surfaceProviderFailure(error, 'change');
	}
}

function transitionTarget(
	current: CampaignDetail,
	transition: TransitionCampaignCommand['transition'],
): 'draft' | 'scheduled' | 'running' | 'paused' | 'cancelled' {
	switch (transition) {
		case 'schedule':
			if (current.status !== 'draft') throw createPublicError('Only a draft campaign can be scheduled.', 409);
			if (current.sendAt === null || Date.parse(current.sendAt) <= Date.now()) {
				throw createPublicError('Save a future scheduled time before scheduling this campaign.', 409);
			}
			return 'scheduled';
		case 'unschedule':
			if (current.status !== 'scheduled') throw createPublicError('Only a scheduled campaign can return to draft.', 409);
			return 'draft';
		case 'start':
			if (current.status !== 'draft') throw createPublicError('Only a draft campaign can start now.', 409);
			if (current.sendAt !== null) throw createPublicError('Remove the scheduled time before sending this campaign now.', 409);
			return 'running';
		case 'pause':
			if (current.status !== 'running') throw createPublicError('Only a running campaign can be paused.', 409);
			return 'paused';
		case 'resume':
			if (current.status !== 'paused') throw createPublicError('Only a paused campaign can resume.', 409);
			// Listmonk stores a requested running status as scheduled whenever the
			// campaign still owns a send_at value. Use that truthful target here.
			return current.sendAt === null ? 'running' : 'scheduled';
		case 'cancel':
			if (current.status !== 'running' && current.status !== 'paused') {
				throw createPublicError('Only a running or paused campaign can be cancelled.', 409);
			}
			return 'cancelled';
	}
}

export async function transitionAuthorizedCampaign(
	input: TransitionCampaignCommand,
	headers: Headers,
	dependencies: CampaignServiceDependencies,
): Promise<void> {
	const command = parse(TransitionCampaignCommandSchema, input);
	await authorize(headers, 'send', dependencies);
	const current = (await dependencies.manager.get(command.id)) ?? notFound();
	requireCurrentVersion(current, command.expectedUpdatedAt);
	const target = transitionTarget(current, command.transition);
	try {
		await dependencies.manager.transition(current.id, target);
	} catch (error) {
		surfaceProviderFailure(error, 'change');
	}
}

export async function previewAuthorizedCampaign(
	input: unknown,
	headers: Headers,
	dependencies: CampaignServiceDependencies,
): Promise<string> {
	const id = parse(CampaignIdSchema, input);
	await authorize(headers, 'view', dependencies);
	try {
		return await dependencies.manager.preview(id);
	} catch (error) {
		surfaceProviderFailure(error, 'preview');
	}
}
