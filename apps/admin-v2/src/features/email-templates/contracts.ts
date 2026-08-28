import * as v from 'valibot';

const templateId = v.pipe(v.number(), v.safeInteger(), v.minValue(1, 'Select a valid email template.'));
const name = v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a template name.'), v.maxLength(255, 'Template name is too long.'));
const subject = v.pipe(v.string(), v.maxLength(1_000, 'Subject is too long.'));
const body = v.pipe(
	v.string(),
	v.minLength(1, 'Enter template HTML.'),
	v.maxLength(5_000_000, 'Template HTML is too large.'),
	v.check((value) => new TextEncoder().encode(value).byteLength <= 5_000_000, 'Template HTML is too large.'),
);

export const EmailTemplateIdSchema = templateId;
export const EmailTemplateKindSchema = v.picklist(['tx', 'campaign', 'campaign_visual'] as const);
export const AuthorableEmailTemplateKindSchema = v.picklist(['tx', 'campaign'] as const);
export const EmailTemplateCapabilitySchema = v.picklist(['view', 'create', 'edit', 'delete', 'set-default'] as const);
export const CreateEmailTemplateCommandSchema = v.strictObject({
	name,
	kind: AuthorableEmailTemplateKindSchema,
	subject,
	body,
});
export const UpdateEmailTemplateCommandSchema = v.strictObject({
	id: templateId,
	name,
	subject,
	body,
});
export const PreviewNewEmailTemplateCommandSchema = v.strictObject({
	kind: AuthorableEmailTemplateKindSchema,
	body,
});
export const PreviewEditedEmailTemplateCommandSchema = v.strictObject({
	id: templateId,
	body,
});

export type EmailTemplateKind = v.InferOutput<typeof EmailTemplateKindSchema>;
export type AuthorableEmailTemplateKind = v.InferOutput<typeof AuthorableEmailTemplateKindSchema>;
export type EmailTemplateCapability = v.InferOutput<typeof EmailTemplateCapabilitySchema>;
export type CreateEmailTemplateCommand = v.InferInput<typeof CreateEmailTemplateCommandSchema>;
export type UpdateEmailTemplateCommand = v.InferInput<typeof UpdateEmailTemplateCommandSchema>;
export type PreviewNewEmailTemplateCommand = v.InferInput<typeof PreviewNewEmailTemplateCommandSchema>;
export type PreviewEditedEmailTemplateCommand = v.InferInput<typeof PreviewEditedEmailTemplateCommandSchema>;

export type EmailTemplateSummary = {
	id: number;
	name: string;
	kind: EmailTemplateKind;
	subject: string;
	isDefault: boolean;
	createdAt: string;
	updatedAt: string;
};

export type EmailTemplateDetail = EmailTemplateSummary & {
	body: string;
	hasVisualSource: boolean;
};

/** A diagnostic-free provider failure safe for feature services to classify. */
export class TemplateProviderFailure extends Error {
	constructor(public readonly status: number) {
		super(`Listmonk template request failed with status ${status}.`);
		this.name = 'TemplateProviderFailure';
	}
}

/** Custom-error constructors may be duplicated across lazy Start Mode chunks. */
export function isTemplateProviderFailure(error: unknown): error is TemplateProviderFailure {
	return (
		typeof error === 'object' &&
		error !== null &&
		'name' in error &&
		error.name === 'TemplateProviderFailure' &&
		'status' in error &&
		typeof error.status === 'number'
	);
}
