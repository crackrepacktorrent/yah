import 'server-only';
import * as v from 'valibot';

const MAX_PROVIDER_ITEMS = 100;
const MAX_SETTINGS_LIST_ITEMS = 10_000;
const MAX_OBJECT_ENTRIES = 100;
const maskedSecretPattern = /^(?:|\u2022+)$/u;

const integerSchema = v.pipe(v.number(), v.safeInteger());
const stringListSchema = v.pipe(v.array(v.string()), v.maxLength(MAX_SETTINGS_LIST_ITEMS));
const smtpAuthProtocolSchema = v.picklist(['login', 'cram', 'plain', 'none'] as const);
const smtpTlsTypeSchema = v.picklist(['TLS', 'STARTTLS', 'none'] as const);
const bounceActionValueSchema = v.picklist(['none', 'unsubscribe', 'blocklist', 'delete'] as const);
const exportableSchema = v.pipe(
	v.array(v.picklist(['profile', 'subscriptions', 'campaign_views', 'link_clicks'] as const)),
	v.maxLength(4),
);
const maskedSecretSchema = v.pipe(
	v.string(),
	v.regex(maskedSecretPattern, 'Expected an empty or Listmonk-masked secret.'),
);

function isPlainRecord(input: unknown): input is Record<string, unknown> {
	return typeof input === 'object' && input !== null && !Array.isArray(input);
}

const boundedStringRecordSchema = v.custom<Record<string, string>>(
	(input) => isPlainRecord(input)
		&& Object.keys(input).length <= MAX_OBJECT_ENTRIES
		&& Object.values(input).every((value) => typeof value === 'string'),
	'Expected a bounded string-to-string object.',
);

const smtpSchema = v.object({
	name: v.string(),
	uuid: v.string(),
	enabled: v.boolean(),
	host: v.string(),
	hello_hostname: v.string(),
	port: integerSchema,
	auth_protocol: smtpAuthProtocolSchema,
	username: v.string(),
	// encoding/json omits an empty password because the Go field has `omitempty`.
	password: v.optional(maskedSecretSchema),
	email_headers: v.pipe(v.array(boundedStringRecordSchema), v.maxLength(MAX_OBJECT_ENTRIES)),
	max_conns: integerSchema,
	max_msg_retries: integerSchema,
	msg_retry_delay: v.string(),
	idle_timeout: v.string(),
	wait_timeout: v.string(),
	tls_type: smtpTlsTypeSchema,
	tls_skip_verify: v.boolean(),
	from_addresses: stringListSchema,
});

const messengerSchema = v.object({
	uuid: v.string(),
	enabled: v.boolean(),
	name: v.string(),
	root_url: v.string(),
	username: v.string(),
	password: v.optional(maskedSecretSchema),
	max_conns: integerSchema,
	timeout: v.string(),
	max_msg_retries: integerSchema,
});

const bounceActionSchema = v.object({
	count: v.pipe(integerSchema, v.minValue(1), v.maxValue(1_000)),
	action: bounceActionValueSchema,
});
const bounceActionsSchema = v.object({
	soft: bounceActionSchema,
	hard: bounceActionSchema,
	complaint: bounceActionSchema,
});

const bounceMailboxSchema = v.object({
	uuid: v.string(),
	enabled: v.boolean(),
	type: v.literal('pop'),
	host: v.string(),
	port: integerSchema,
	auth_protocol: v.picklist(['none', 'userpass'] as const),
	return_path: v.string(),
	username: v.string(),
	password: v.optional(maskedSecretSchema),
	tls_enabled: v.boolean(),
	tls_skip_verify: v.boolean(),
	scan_interval: v.string(),
});

const settingsDocumentSchema = v.object({
	'app.site_name': v.string(),
	'app.root_url': v.string(),
	'app.logo_url': v.string(),
	'app.favicon_url': v.string(),
	'app.from_email': v.string(),
	'app.notify_emails': stringListSchema,
	'app.enable_public_subscription_page': v.boolean(),
	'app.enable_public_archive': v.boolean(),
	'app.enable_public_archive_rss_content': v.boolean(),
	'app.show_optin_page': v.boolean(),
	'app.send_optin_confirmation': v.boolean(),
	'app.check_updates': v.boolean(),
	'app.lang': v.string(),

	'app.batch_size': integerSchema,
	'app.concurrency': integerSchema,
	'app.max_send_errors': integerSchema,
	'app.message_rate': integerSchema,
	'app.cache_slow_queries': v.boolean(),
	'app.cache_slow_queries_interval': v.string(),
	'app.message_sliding_window': v.boolean(),
	'app.message_sliding_window_duration': v.string(),
	'app.message_sliding_window_rate': integerSchema,

	'privacy.individual_tracking': v.boolean(),
	'privacy.disable_tracking': v.boolean(),
	'privacy.unsubscribe_header': v.boolean(),
	'privacy.allow_blocklist': v.boolean(),
	'privacy.allow_preferences': v.boolean(),
	'privacy.allow_export': v.boolean(),
	'privacy.allow_wipe': v.boolean(),
	'privacy.exportable': exportableSchema,
	'privacy.record_optin_ip': v.boolean(),
	'privacy.domain_blocklist': stringListSchema,
	'privacy.domain_allowlist': stringListSchema,

	'security.captcha': v.object({
		altcha: v.object({
			enabled: v.boolean(),
			complexity: integerSchema,
		}),
		hcaptcha: v.object({
			enabled: v.boolean(),
			key: v.string(),
			secret: maskedSecretSchema,
		}),
	}),
	'security.oidc': v.object({
		enabled: v.boolean(),
		provider_url: v.string(),
		provider_name: v.string(),
		client_id: v.string(),
		client_secret: maskedSecretSchema,
		auto_create_users: v.boolean(),
		default_user_role_id: v.nullable(integerSchema),
		default_list_role_id: v.nullable(integerSchema),
	}),
	'security.trusted_urls': stringListSchema,

	'upload.provider': v.string(),
	'upload.extensions': stringListSchema,
	'upload.filesystem.upload_path': v.string(),
	'upload.filesystem.upload_uri': v.string(),
	'upload.s3.url': v.string(),
	'upload.s3.public_url': v.string(),
	'upload.s3.aws_access_key_id': v.string(),
	'upload.s3.aws_default_region': v.string(),
	'upload.s3.aws_secret_access_key': v.optional(maskedSecretSchema),
	'upload.s3.bucket': v.string(),
	'upload.s3.bucket_domain': v.string(),
	'upload.s3.bucket_path': v.string(),
	'upload.s3.bucket_type': v.string(),
	'upload.s3.expiry': v.string(),

	smtp: v.pipe(v.array(smtpSchema), v.maxLength(MAX_PROVIDER_ITEMS)),
	messengers: v.pipe(v.array(messengerSchema), v.maxLength(MAX_PROVIDER_ITEMS)),

	'bounce.enabled': v.boolean(),
	'bounce.webhooks_enabled': v.boolean(),
	'bounce.actions': bounceActionsSchema,
	'bounce.ses_enabled': v.boolean(),
	'bounce.sendgrid_enabled': v.boolean(),
	'bounce.sendgrid_key': maskedSecretSchema,
	'bounce.azure': v.object({
		enabled: v.boolean(),
		shared_secret: maskedSecretSchema,
		shared_secret_header: v.string(),
	}),
	'bounce.postmark': v.object({
		enabled: v.boolean(),
		username: v.string(),
		password: maskedSecretSchema,
	}),
	'bounce.forwardemail': v.object({
		enabled: v.boolean(),
		key: maskedSecretSchema,
	}),
	'bounce.lettermint': v.object({
		enabled: v.boolean(),
		key: maskedSecretSchema,
	}),
	'bounce.mailboxes': v.pipe(v.array(bounceMailboxSchema), v.maxLength(MAX_PROVIDER_ITEMS)),

	'maintenance.db': v.object({
		vacuum: v.boolean(),
		vacuum_cron_interval: v.string(),
	}),

	'appearance.admin.custom_css': v.string(),
	'appearance.admin.custom_js': v.string(),
	'appearance.public.custom_css': v.string(),
	'appearance.public.custom_js': v.string(),
});

export type ListmonkV62SettingsDocument = Record<string, unknown>;

/**
 * Validates the complete document returned by Listmonk v6.2's GET /settings.
 *
 * The original record is returned intentionally: Listmonk's settings update is
 * a full-document PUT, so unknown keys introduced by a later provider version
 * must survive the GET/merge/PUT cycle.
 */
export function validateListmonkV62SettingsDocument(input: unknown): ListmonkV62SettingsDocument {
	if (typeof input !== 'object' || input === null || Array.isArray(input)) {
		throw new Error('Listmonk returned an invalid complete v6.2 settings document.');
	}

	const result = v.safeParse(settingsDocumentSchema, input, { abortEarly: true });
	if (!result.success) {
		const path = result.issues[0]?.path?.map((item) => String(item.key)).join('.');
		throw new Error(`Listmonk returned an invalid complete v6.2 settings document${path ? ` at ${path}` : ''}.`);
	}

	return input as ListmonkV62SettingsDocument;
}
