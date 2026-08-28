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
import { runProductionRequest } from '~/platform/production-request.server';

async function requestDependencies(headers: Headers) {
	const [{ createAuthorizationContext }, { productionEmailTemplateManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-template-manager.server'),
	]);
	return { authorization: createAuthorizationContext(headers), manager: productionEmailTemplateManager };
}

export const listEmailTemplates = query(async (): Promise<EmailTemplateSummary[]> => {
	'use server';
	return runProductionRequest(async (request) => listAuthorizedEmailTemplates(await requestDependencies(request.headers)));
}, 'email-templates');

export const getEmailTemplate = query(async (id: number): Promise<EmailTemplateDetail> => {
	'use server';
	return runProductionRequest(async (request) => readAuthorizedEmailTemplate(id, await requestDependencies(request.headers)));
}, 'email-template');

export const requireEmailTemplateCapability = query(async (capability: EmailTemplateCapability): Promise<true> => {
	'use server';
	return runProductionRequest(async (request) =>
		requireAuthorizedEmailTemplateCapability(capability, await requestDependencies(request.headers)),
	);
}, 'email-template-capability');

export const previewSavedEmailTemplate = query(async (id: number): Promise<string> => {
	'use server';
	return runProductionRequest(async (request) =>
		previewAuthorizedSavedEmailTemplate(id, await requestDependencies(request.headers)),
	);
}, 'email-template-preview');

export async function createEmailTemplate(command: CreateEmailTemplateCommand): Promise<{ id: number }> {
	'use server';
	return runProductionRequest(async (request) =>
		createAuthorizedEmailTemplate(command, await requestDependencies(request.headers)),
	);
}

export async function updateEmailTemplate(command: UpdateEmailTemplateCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) =>
		updateAuthorizedEmailTemplate(command, await requestDependencies(request.headers)),
	);
}

export async function deleteEmailTemplate(id: number): Promise<void> {
	'use server';
	return runProductionRequest(async (request) => deleteAuthorizedEmailTemplate(id, await requestDependencies(request.headers)));
}

export async function setDefaultEmailTemplate(id: number): Promise<void> {
	'use server';
	return runProductionRequest(async (request) =>
		setAuthorizedDefaultEmailTemplate(id, await requestDependencies(request.headers)),
	);
}

export async function previewNewEmailTemplate(command: PreviewNewEmailTemplateCommand): Promise<string> {
	'use server';
	return runProductionRequest(async (request) =>
		previewAuthorizedNewEmailTemplate(command, await requestDependencies(request.headers)),
	);
}

export async function previewEditedEmailTemplate(command: PreviewEditedEmailTemplateCommand): Promise<string> {
	'use server';
	return runProductionRequest(async (request) =>
		previewAuthorizedEditedEmailTemplate(command, await requestDependencies(request.headers)),
	);
}
