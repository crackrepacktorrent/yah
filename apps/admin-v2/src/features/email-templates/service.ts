import type { AuthorizationContext } from '~/platform/auth/authorization-context';
import { createPublicError } from '~/platform/errors';
import { createPublicInputParser } from '~/platform/public-input';
import {
	CreateEmailTemplateCommandSchema,
	EmailTemplateCapabilitySchema,
	EmailTemplateIdSchema,
	PreviewEditedEmailTemplateCommandSchema,
	PreviewNewEmailTemplateCommandSchema,
	UpdateEmailTemplateCommandSchema,
	isTemplateProviderFailure,
	type AuthorableEmailTemplateKind,
	type CreateEmailTemplateCommand,
	type EmailTemplateCapability,
	type EmailTemplateDetail,
	type EmailTemplateSummary,
	type PreviewEditedEmailTemplateCommand,
	type PreviewNewEmailTemplateCommand,
	type UpdateEmailTemplateCommand,
} from './contracts';

export type EmailTemplateManager = {
	list(): Promise<EmailTemplateSummary[]>;
	get(id: number): Promise<EmailTemplateDetail | null>;
	create(input: { name: string; kind: AuthorableEmailTemplateKind; subject: string; body: string }): Promise<EmailTemplateDetail>;
	update(input: { id: number; name: string; subject: string; body: string }): Promise<void>;
	delete(id: number): Promise<void>;
	setDefault(id: number): Promise<void>;
	previewSaved(id: number): Promise<string>;
	previewDraft(input: { kind: AuthorableEmailTemplateKind; body: string }): Promise<string>;
};

export type EmailTemplateServiceDependencies = {
	authorization: AuthorizationContext;
	manager: EmailTemplateManager;
};
const parse = createPublicInputParser('Invalid email template data.');

async function authorize(
	capability: EmailTemplateCapability,
	dependencies: EmailTemplateServiceDependencies,
): Promise<void> {
	await dependencies.authorization.requirePermissions({ template: [capability] });
}

const contentSlot = /\{\{\s*template\s+"content"\s*\.\s*\}\}/g;

export function countCampaignContentSlots(body: string): number {
	return body.match(contentSlot)?.length ?? 0;
}

function requireValidBody(kind: AuthorableEmailTemplateKind, body: string): void {
	if (kind === 'campaign' && countCampaignContentSlots(body) !== 1) {
		throw createPublicError('Campaign templates must contain exactly one {{ template "content" . }} placeholder.', 400);
	}
}

function requireValidSubject(kind: AuthorableEmailTemplateKind, subject: string): void {
	if (kind === 'tx' && subject.trim().length === 0) {
		throw createPublicError('Enter a subject for transactional templates.', 400);
	}
}

function notFound(): never {
	throw createPublicError('Email template not found.', 404);
}

async function surfaceExpectedMutationFailure(operation: () => Promise<void>): Promise<void> {
	try {
		await operation();
	} catch (error) {
		if (isTemplateProviderFailure(error) && error.status === 404) notFound();
		if (isTemplateProviderFailure(error) && [400, 409, 422].includes(error.status)) {
			throw createPublicError('The email template changed before this action completed. Refresh and try again.', 409);
		}
		throw error;
	}
}

function surfaceTemplateContentFailure(error: unknown, missingIsNotFound: boolean): never {
	if (missingIsNotFound && isTemplateProviderFailure(error) && error.status === 404) notFound();
	if (isTemplateProviderFailure(error) && [400, 422].includes(error.status)) {
		throw createPublicError('Listmonk rejected the template HTML or expressions.', 400);
	}
	throw error;
}

async function preview(operation: () => Promise<string>, missingIsNotFound: boolean): Promise<string> {
	try {
		return await operation();
	} catch (error) {
		if (missingIsNotFound && isTemplateProviderFailure(error) && error.status === 404) notFound();
		if (isTemplateProviderFailure(error) && [400, 422].includes(error.status)) {
			throw createPublicError('Listmonk could not render this template. Check its HTML and template expressions.', 400);
		}
		throw error;
	}
}

export async function requireAuthorizedEmailTemplateCapability(
	input: unknown,
	dependencies: EmailTemplateServiceDependencies,
): Promise<true> {
	const capability = parse(EmailTemplateCapabilitySchema, input);
	await authorize(capability, dependencies);
	return true;
}

export async function listAuthorizedEmailTemplates(
	dependencies: EmailTemplateServiceDependencies,
): Promise<EmailTemplateSummary[]> {
	await authorize('view', dependencies);
	return dependencies.manager.list();
}

export async function readAuthorizedEmailTemplate(
	input: unknown,
	dependencies: EmailTemplateServiceDependencies,
): Promise<EmailTemplateDetail> {
	const id = parse(EmailTemplateIdSchema, input);
	await authorize('view', dependencies);
	return (await dependencies.manager.get(id)) ?? notFound();
}

export async function createAuthorizedEmailTemplate(
	input: CreateEmailTemplateCommand,
	dependencies: EmailTemplateServiceDependencies,
): Promise<{ id: number }> {
	const command = parse(CreateEmailTemplateCommandSchema, input);
	requireValidBody(command.kind, command.body);
	requireValidSubject(command.kind, command.subject);
	await authorize('create', dependencies);
	try {
		const created = await dependencies.manager.create({
			...command,
			subject: command.kind === 'tx' ? command.subject : '',
		});
		return { id: created.id };
	} catch (error) {
		surfaceTemplateContentFailure(error, false);
	}
}

export async function updateAuthorizedEmailTemplate(
	input: UpdateEmailTemplateCommand,
	dependencies: EmailTemplateServiceDependencies,
): Promise<void> {
	const command = parse(UpdateEmailTemplateCommandSchema, input);
	await authorize('edit', dependencies);
	const existing = await dependencies.manager.get(command.id);
	if (!existing) notFound();
	if (existing.kind === 'campaign_visual') {
		throw createPublicError('Visual template content is read-only until a compatible visual editor is available.', 409);
	}
	requireValidBody(existing.kind, command.body);
	requireValidSubject(existing.kind, command.subject);
	try {
		await dependencies.manager.update({
			...command,
			subject: existing.kind === 'tx' ? command.subject : '',
		});
	} catch (error) {
		surfaceTemplateContentFailure(error, true);
	}
}

export async function deleteAuthorizedEmailTemplate(
	input: unknown,
	dependencies: EmailTemplateServiceDependencies,
): Promise<void> {
	const id = parse(EmailTemplateIdSchema, input);
	await authorize('delete', dependencies);
	const existing = await dependencies.manager.get(id);
	if (!existing) notFound();
	if (existing.isDefault) throw createPublicError('The default campaign template cannot be deleted.', 409);
	await surfaceExpectedMutationFailure(() => dependencies.manager.delete(id));
}

export async function setAuthorizedDefaultEmailTemplate(
	input: unknown,
	dependencies: EmailTemplateServiceDependencies,
): Promise<void> {
	const id = parse(EmailTemplateIdSchema, input);
	await authorize('set-default', dependencies);
	const existing = await dependencies.manager.get(id);
	if (!existing) notFound();
	if (existing.kind !== 'campaign') throw createPublicError('Only HTML campaign templates can be the default.', 409);
	if (existing.isDefault) return;
	await surfaceExpectedMutationFailure(() => dependencies.manager.setDefault(id));
}

export async function previewAuthorizedSavedEmailTemplate(
	input: unknown,
	dependencies: EmailTemplateServiceDependencies,
): Promise<string> {
	const id = parse(EmailTemplateIdSchema, input);
	await authorize('view', dependencies);
	return preview(() => dependencies.manager.previewSaved(id), true);
}

export async function previewAuthorizedNewEmailTemplate(
	input: PreviewNewEmailTemplateCommand,
	dependencies: EmailTemplateServiceDependencies,
): Promise<string> {
	const command = parse(PreviewNewEmailTemplateCommandSchema, input);
	requireValidBody(command.kind, command.body);
	await authorize('create', dependencies);
	return preview(() => dependencies.manager.previewDraft(command), false);
}

export async function previewAuthorizedEditedEmailTemplate(
	input: PreviewEditedEmailTemplateCommand,
	dependencies: EmailTemplateServiceDependencies,
): Promise<string> {
	const command = parse(PreviewEditedEmailTemplateCommandSchema, input);
	await authorize('edit', dependencies);
	const existing = await dependencies.manager.get(command.id);
	if (!existing) notFound();
	const kind = existing.kind;
	if (kind === 'campaign_visual') {
		throw createPublicError('Visual templates use their saved visual preview.', 409);
	}
	requireValidBody(kind, command.body);
	return preview(() => dependencies.manager.previewDraft({ kind, body: command.body }), true);
}
