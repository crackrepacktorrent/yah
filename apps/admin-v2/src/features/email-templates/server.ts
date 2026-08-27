import { query } from '@solidjs/router';
import type {
	CreateEmailTemplateCommand,
	EmailTemplateCapability,
	EmailTemplateDetail,
	EmailTemplateSummary,
	PreviewEditedEmailTemplateCommand,
	PreviewNewEmailTemplateCommand,
	UpdateEmailTemplateCommand,
} from './contracts';
import {
	createAuthorizedEmailTemplate,
	deleteAuthorizedEmailTemplate,
	listAuthorizedEmailTemplates,
	previewAuthorizedEditedEmailTemplate,
	previewAuthorizedNewEmailTemplate,
	previewAuthorizedSavedEmailTemplate,
	readAuthorizedEmailTemplate,
	requireAuthorizedEmailTemplateCapability,
	setAuthorizedDefaultEmailTemplate,
	updateAuthorizedEmailTemplate,
} from './service';
import { surfaceError } from '~/platform/errors';
import { getServerRequest } from '~/platform/request';
import { requireProductionRuntime } from '~/platform/runtime.server';

async function dependencies() {
	const [{ enforcePermissions }, { productionEmailTemplateManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-template-manager.server'),
	]);
	return { enforcePermissions, manager: productionEmailTemplateManager };
}

export const listEmailTemplates = query(async (): Promise<EmailTemplateSummary[]> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await listAuthorizedEmailTemplates(request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'email-templates');

export const getEmailTemplate = query(async (id: number): Promise<EmailTemplateDetail> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await readAuthorizedEmailTemplate(id, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'email-template');

export const requireEmailTemplateCapability = query(async (capability: EmailTemplateCapability): Promise<true> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await requireAuthorizedEmailTemplateCapability(capability, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'email-template-capability');

export const previewSavedEmailTemplate = query(async (id: number): Promise<string> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await previewAuthorizedSavedEmailTemplate(id, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'email-template-preview');

export async function createEmailTemplate(command: CreateEmailTemplateCommand): Promise<{ id: number }> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await createAuthorizedEmailTemplate(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function updateEmailTemplate(command: UpdateEmailTemplateCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await updateAuthorizedEmailTemplate(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function deleteEmailTemplate(id: number): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await deleteAuthorizedEmailTemplate(id, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function setDefaultEmailTemplate(id: number): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await setAuthorizedDefaultEmailTemplate(id, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function previewNewEmailTemplate(command: PreviewNewEmailTemplateCommand): Promise<string> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await previewAuthorizedNewEmailTemplate(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function previewEditedEmailTemplate(command: PreviewEditedEmailTemplateCommand): Promise<string> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await previewAuthorizedEditedEmailTemplate(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}
