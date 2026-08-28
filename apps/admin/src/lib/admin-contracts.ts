import * as v from 'valibot';
import {
	dateTimeSchema,
	emailSchema,
	httpUrlSchema,
	idListSchema,
	nonEmptyStringSchema,
	nonNegativeIntegerSchema,
	optionalTextSchema,
	positiveIntegerSchema,
} from './schemas';

const nameSchema = v.pipe(nonEmptyStringSchema, v.maxLength(255));
const bodySchema = v.pipe(v.string(), v.maxLength(5_000_000, 'Content is too large.'));
const tagSchema = v.pipe(nonEmptyStringSchema, v.maxLength(100));
const tagsSchema = v.pipe(v.array(tagSchema), v.maxLength(100));
const optionalDateTimeSchema = v.optional(dateTimeSchema);
const optionalIdSchema = v.optional(positiveIntegerSchema);

export const AnalyticsPeriodSchema = v.picklist(['24h', '7d', '30d'] as const);

export const TemplateIdSchema = positiveIntegerSchema;
export const CreateTemplateInputSchema = v.strictObject({
	name: nameSchema,
	type: v.optional(v.picklist(['tx', 'campaign', 'campaign_visual'] as const)),
	subject: optionalTextSchema,
	body: bodySchema,
});
export const UpdateTemplateInputSchema = v.strictObject({
	id: positiveIntegerSchema,
	name: nameSchema,
	subject: v.pipe(v.string(), v.maxLength(1_000)),
	body: bodySchema,
});

export const CampaignAnalyticsInputSchema = v.pipe(
	v.strictObject({
		campaignIds: idListSchema,
		type: v.picklist(['views', 'clicks'] as const),
		from: dateTimeSchema,
		to: dateTimeSchema,
	}),
	v.check((input) => Date.parse(input.from) <= Date.parse(input.to), 'Start date must be before end date.'),
);

export const CreateCampaignInputSchema = v.strictObject({
	name: nameSchema,
	subject: v.pipe(nonEmptyStringSchema, v.maxLength(1_000)),
	fromEmail: optionalTextSchema,
	lists: idListSchema,
	body: v.optional(bodySchema),
	contentType: v.optional(v.picklist(['richtext', 'html', 'markdown', 'plain'] as const)),
	templateId: optionalIdSchema,
	tags: v.optional(tagsSchema),
	sendAt: optionalDateTimeSchema,
});

export const UpdateCampaignInputSchema = v.strictObject({
	id: positiveIntegerSchema,
	name: v.optional(nameSchema),
	subject: v.optional(v.pipe(nonEmptyStringSchema, v.maxLength(1_000))),
	fromEmail: optionalTextSchema,
	lists: idListSchema,
	body: v.optional(bodySchema),
	contentType: v.optional(v.picklist(['richtext', 'html', 'markdown', 'plain'] as const)),
	templateId: optionalIdSchema,
	tags: v.optional(tagsSchema),
	sendAt: v.optional(v.nullable(dateTimeSchema)),
});

export const CampaignStatusInputSchema = v.strictObject({
	id: positiveIntegerSchema,
	status: v.picklist(['running', 'paused', 'cancelled', 'scheduled'] as const),
});

export const TestCampaignInputSchema = v.strictObject({
	id: positiveIntegerSchema,
	subscribers: v.pipe(v.array(emailSchema), v.minLength(1), v.maxLength(50)),
});

export const SubscriberIdSchema = positiveIntegerSchema;
export const CreateSubscriberInputSchema = v.strictObject({
	email: emailSchema,
	name: optionalTextSchema,
	status: v.optional(v.picklist(['enabled', 'disabled', 'blocklisted'] as const)),
	listIds: v.optional(v.pipe(v.array(positiveIntegerSchema), v.maxLength(500))),
	preconfirm: v.optional(v.boolean()),
});
export const UpdateSubscriberInputSchema = v.strictObject({
	id: positiveIntegerSchema,
	email: v.optional(emailSchema),
	name: optionalTextSchema,
	status: v.optional(v.picklist(['enabled', 'disabled', 'blocklisted'] as const)),
	listIds: v.optional(v.pipe(v.array(positiveIntegerSchema), v.maxLength(500))),
	preconfirm: v.optional(v.boolean()),
});

export const ListIdSchema = positiveIntegerSchema;
export const CreateListInputSchema = v.strictObject({
	name: nameSchema,
	type: v.picklist(['public', 'private'] as const),
	optin: v.picklist(['single', 'double'] as const),
	description: optionalTextSchema,
});
export const UpdateListInputSchema = v.strictObject({
	id: positiveIntegerSchema,
	name: v.optional(nameSchema),
	type: v.optional(v.picklist(['public', 'private'] as const)),
	optin: v.optional(v.picklist(['single', 'double'] as const)),
	description: optionalTextSchema,
});

export const ShortCodeSchema = v.pipe(
	nonEmptyStringSchema,
	v.maxLength(255),
	v.regex(/^[^/?#\s]+$/, 'Short code contains unsupported characters.'),
);
const maxVisitsSchema = v.nullable(nonNegativeIntegerSchema);
export const CreateShortUrlInputSchema = v.strictObject({
	longUrl: httpUrlSchema,
	customSlug: v.optional(ShortCodeSchema),
	title: optionalTextSchema,
	tags: tagsSchema,
	maxVisits: maxVisitsSchema,
	validUntil: optionalDateTimeSchema,
	crawlable: v.boolean(),
	forwardQuery: v.boolean(),
});
export const EditShortUrlInputSchema = v.strictObject({
	shortCode: ShortCodeSchema,
	longUrl: httpUrlSchema,
	title: optionalTextSchema,
	tags: tagsSchema,
	maxVisits: maxVisitsSchema,
	validUntil: optionalDateTimeSchema,
	crawlable: v.boolean(),
	forwardQuery: v.boolean(),
});

export const BulkIdsSchema = idListSchema;

const bounceActionSchema = v.strictObject({
	count: positiveIntegerSchema,
	action: v.picklist(['blocklist', 'delete', 'none'] as const),
});
const smtpConfigSchema = v.strictObject({
	uuid: v.pipe(nonEmptyStringSchema, v.maxLength(128)),
	enabled: v.boolean(),
	host: v.pipe(nonEmptyStringSchema, v.maxLength(255)),
	port: v.pipe(positiveIntegerSchema, v.maxValue(65_535)),
	auth_protocol: v.picklist(['login', 'cram', 'plain', 'none'] as const),
	username: v.pipe(v.string(), v.maxLength(1_000)),
	password: v.pipe(v.string(), v.maxLength(10_000)),
	email_headers: v.pipe(
		v.array(
			v.strictObject({
				key: v.pipe(nonEmptyStringSchema, v.maxLength(255)),
				value: v.pipe(v.string(), v.maxLength(2_000)),
			}),
		),
		v.maxLength(100),
	),
	hello_hostname: v.pipe(v.string(), v.maxLength(255)),
	max_conns: v.pipe(positiveIntegerSchema, v.maxValue(10_000)),
	max_msg_retries: v.pipe(nonNegativeIntegerSchema, v.maxValue(1_000)),
	idle_timeout: v.pipe(nonEmptyStringSchema, v.maxLength(64)),
	wait_timeout: v.pipe(nonEmptyStringSchema, v.maxLength(64)),
	tls_type: v.picklist(['TLS', 'STARTTLS', 'none'] as const),
	tls_skip_verify: v.boolean(),
});

const urlOrEmptySchema = v.union([v.literal(''), httpUrlSchema]);
export const EmailSettingsPatchSchema = v.pipe(
	v.partial(
		v.strictObject({
			smtp: v.pipe(v.array(smtpConfigSchema), v.maxLength(100)),
			'app.site_name': v.pipe(v.string(), v.maxLength(255)),
			'app.root_url': urlOrEmptySchema,
			'app.logo_url': urlOrEmptySchema,
			'app.favicon_url': urlOrEmptySchema,
			'app.from_email': v.pipe(v.string(), v.maxLength(1_000)),
			'app.notify_emails': v.pipe(v.array(emailSchema), v.maxLength(100)),
			'app.send_optin_confirmation': v.boolean(),
			'app.enable_public_subscription_page': v.boolean(),
			'app.enable_public_archive': v.boolean(),
			'app.enable_public_archive_rss_content': v.boolean(),
			'app.check_updates': v.boolean(),
			'app.concurrency': v.pipe(positiveIntegerSchema, v.maxValue(10_000)),
			'app.message_rate': v.pipe(nonNegativeIntegerSchema, v.maxValue(1_000_000)),
			'app.batch_size': v.pipe(positiveIntegerSchema, v.maxValue(10_000_000)),
			'app.max_send_errors': v.pipe(nonNegativeIntegerSchema, v.maxValue(10_000_000)),
			'app.message_sliding_window': v.boolean(),
			'app.message_sliding_window_rate': v.pipe(nonNegativeIntegerSchema, v.maxValue(1_000_000)),
			'app.message_sliding_window_duration': v.pipe(nonEmptyStringSchema, v.maxLength(64)),
			'privacy.individual_tracking': v.boolean(),
			'privacy.unsubscribe_header': v.boolean(),
			'privacy.record_optin_ip': v.boolean(),
			'privacy.allow_blocklist': v.boolean(),
			'privacy.allow_preferences': v.boolean(),
			'privacy.allow_export': v.boolean(),
			'privacy.allow_wipe': v.boolean(),
			'privacy.domain_blocklist': v.pipe(v.array(v.pipe(nonEmptyStringSchema, v.maxLength(255))), v.maxLength(10_000)),
			'privacy.domain_allowlist': v.pipe(v.array(v.pipe(nonEmptyStringSchema, v.maxLength(255))), v.maxLength(10_000)),
			'bounce.enabled': v.boolean(),
			'bounce.webhooks_enabled': v.boolean(),
			'bounce.actions': v.strictObject({
				complaint: bounceActionSchema,
				hard: bounceActionSchema,
				soft: bounceActionSchema,
			}),
			'bounce.ses_enabled': v.boolean(),
			'bounce.sendgrid_enabled': v.boolean(),
			'bounce.sendgrid_key': v.pipe(v.string(), v.maxLength(10_000)),
			'bounce.postmark': v.strictObject({
				enabled: v.boolean(),
				username: v.pipe(v.string(), v.maxLength(1_000)),
				password: v.pipe(v.string(), v.maxLength(10_000)),
			}),
			'bounce.forwardemail': v.strictObject({
				enabled: v.boolean(),
				key: v.pipe(v.string(), v.maxLength(10_000)),
			}),
		}),
	),
	v.check((settings) => Object.keys(settings).length > 0, 'At least one setting is required.'),
);

export const TestSmtpInputSchema = v.strictObject({
	...smtpConfigSchema.entries,
	email: emailSchema,
});

export type CreateTemplateInput = v.InferOutput<typeof CreateTemplateInputSchema>;
export type UpdateTemplateInput = v.InferOutput<typeof UpdateTemplateInputSchema>;
export type CampaignAnalyticsInput = v.InferOutput<typeof CampaignAnalyticsInputSchema>;
export type CreateCampaignInput = v.InferOutput<typeof CreateCampaignInputSchema>;
export type UpdateCampaignInput = v.InferOutput<typeof UpdateCampaignInputSchema>;
export type CampaignStatusInput = v.InferOutput<typeof CampaignStatusInputSchema>;
export type TestCampaignInput = v.InferOutput<typeof TestCampaignInputSchema>;
export type CreateSubscriberInput = v.InferOutput<typeof CreateSubscriberInputSchema>;
export type UpdateSubscriberInput = v.InferOutput<typeof UpdateSubscriberInputSchema>;
export type CreateListInput = v.InferOutput<typeof CreateListInputSchema>;
export type UpdateListInput = v.InferOutput<typeof UpdateListInputSchema>;
export type CreateShortUrlInput = v.InferOutput<typeof CreateShortUrlInputSchema>;
export type EditShortUrlInput = v.InferOutput<typeof EditShortUrlInputSchema>;
export type EmailSettingsPatch = v.InferOutput<typeof EmailSettingsPatchSchema>;
export type TestSmtpInput = v.InferOutput<typeof TestSmtpInputSchema>;
