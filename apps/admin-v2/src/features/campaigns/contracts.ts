import * as v from 'valibot';

const campaignId = v.pipe(v.number(), v.safeInteger(), v.minValue(1, 'Select a valid campaign.'));
const name = v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a campaign name.'), v.maxLength(255, 'Campaign name is too long.'));
const subject = v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter an email subject.'), v.maxLength(5_000, 'Subject is too long.'));
const fromEmail = v.pipe(v.string(), v.trim(), v.maxLength(1_000, 'From address is too long.'));
const body = v.pipe(
	v.string(),
	v.maxLength(5_000_000, 'Campaign content is too large.'),
	v.check((value) => new TextEncoder().encode(value).byteLength <= 5_000_000, 'Campaign content is too large.'),
);
const listIds = v.pipe(
	v.array(v.pipe(v.number(), v.safeInteger(), v.minValue(1, 'Select a valid mailing list.'))),
	v.minLength(1, 'Select at least one mailing list.'),
	v.maxLength(1_000, 'Too many mailing lists were selected.'),
	v.check((values) => new Set(values).size === values.length, 'Select each mailing list only once.'),
);
const templateId = v.nullable(v.pipe(v.number(), v.safeInteger(), v.minValue(1, 'Select a valid email template.')));
const tags = v.pipe(
	v.array(v.pipe(v.string(), v.trim(), v.minLength(1, 'Remove empty tags.'), v.maxLength(100, 'A campaign tag is too long.'))),
	v.maxLength(100, 'Too many campaign tags were provided.'),
	v.check((values) => new Set(values).size === values.length, 'Campaign tags must be unique.'),
);
const optionalDate = v.nullable(
	v.pipe(v.string(), v.maxLength(64), v.check((value) => !Number.isNaN(Date.parse(value)), 'The scheduled time is invalid.')),
);
export const MAX_BULK_CAMPAIGN_DELETIONS = 100;
const updatedAt = v.pipe(
	v.string(),
	v.maxLength(64),
	v.check((value) => !Number.isNaN(Date.parse(value)), 'The campaign version is invalid.'),
);
export const CampaignIdSchema = campaignId;
export const CampaignTypeSchema = v.picklist(['regular', 'optin'] as const);
export const CampaignStatusSchema = v.picklist(['draft', 'scheduled', 'running', 'paused', 'finished', 'cancelled'] as const);
export const CampaignContentTypeSchema = v.picklist(['richtext', 'html', 'markdown', 'plain', 'visual'] as const);
export const AuthorableCampaignContentTypeSchema = v.picklist(['richtext', 'html', 'markdown', 'plain'] as const);
export const CampaignCapabilitySchema = v.picklist(['view', 'create', 'edit', 'delete', 'send'] as const);
export const CampaignTransitionSchema = v.picklist(['schedule', 'unschedule', 'start', 'pause', 'resume', 'cancel'] as const);
export const CreateCampaignCommandSchema = v.strictObject({
	type: CampaignTypeSchema,
	name,
	subject,
	fromEmail,
	listIds,
	body,
	contentType: AuthorableCampaignContentTypeSchema,
	templateId,
	tags,
	sendAt: optionalDate,
});
export const UpdateCampaignCommandSchema = v.strictObject({
	id: campaignId,
	expectedUpdatedAt: updatedAt,
	name,
	subject,
	fromEmail,
	listIds,
	body,
	contentType: AuthorableCampaignContentTypeSchema,
	templateId,
	tags,
	sendAt: optionalDate,
});
const campaignVersion = v.strictObject({ id: campaignId, expectedUpdatedAt: updatedAt });
export const DeleteCampaignsCommandSchema = v.strictObject({
	campaigns: v.pipe(
		v.array(campaignVersion),
		v.minLength(1, 'Select at least one draft campaign.'),
			v.maxLength(MAX_BULK_CAMPAIGN_DELETIONS, `Delete at most ${MAX_BULK_CAMPAIGN_DELETIONS} campaigns at once.`),
		v.check((values) => new Set(values.map((value) => value.id)).size === values.length, 'Select each campaign only once.'),
	),
});
export const TransitionCampaignCommandSchema = v.strictObject({
	id: campaignId,
	expectedUpdatedAt: updatedAt,
	transition: CampaignTransitionSchema,
});

export type CampaignType = v.InferOutput<typeof CampaignTypeSchema>;
export type CampaignStatus = v.InferOutput<typeof CampaignStatusSchema>;
export type CampaignContentType = v.InferOutput<typeof CampaignContentTypeSchema>;
export type AuthorableCampaignContentType = v.InferOutput<typeof AuthorableCampaignContentTypeSchema>;
export type CampaignCapability = v.InferOutput<typeof CampaignCapabilitySchema>;
export type CampaignTransition = v.InferOutput<typeof CampaignTransitionSchema>;
export type CreateCampaignCommand = v.InferInput<typeof CreateCampaignCommandSchema>;
export type UpdateCampaignCommand = v.InferInput<typeof UpdateCampaignCommandSchema>;
export type DeleteCampaignsCommand = v.InferInput<typeof DeleteCampaignsCommandSchema>;
export type TransitionCampaignCommand = v.InferInput<typeof TransitionCampaignCommandSchema>;

export type CampaignList = { id: number; name: string };

export type CampaignSummary = {
	id: number;
	uuid: string;
	type: CampaignType;
	name: string;
	subject: string;
	fromEmail: string;
	messenger: string;
	status: CampaignStatus;
	contentType: CampaignContentType;
	templateId: number | null;
	sendAt: string | null;
	startedAt: string | null;
	toSend: number;
	sent: number;
	views: number;
	clicks: number;
	bounces: number;
	lists: CampaignList[];
	tags: string[];
	createdAt: string;
	updatedAt: string;
};

export type CampaignDetail = CampaignSummary & {
	body: string;
};

/** A diagnostic-free provider failure safe for feature services to classify. */
export class CampaignProviderFailure extends Error {
	constructor(public readonly status: number) {
		super(`Listmonk campaign request failed with status ${status}.`);
		this.name = 'CampaignProviderFailure';
	}
}

/** Custom-error constructors may be duplicated across lazy Start Mode chunks. */
export function isCampaignProviderFailure(error: unknown): error is CampaignProviderFailure {
	return (
		typeof error === 'object' &&
		error !== null &&
		'name' in error &&
		error.name === 'CampaignProviderFailure' &&
		'status' in error &&
		typeof error.status === 'number'
	);
}
