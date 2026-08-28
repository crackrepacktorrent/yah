import * as v from 'valibot';

export const GO_DURATION_HTML_PATTERN = String.raw`(?:0|\d+(?:\.\d+)?(?:ns|us|µs|μs|ms|s|m|h)(?:\d+(?:\.\d+)?(?:ns|us|µs|μs|ms|s|m|h))*)`;
const maximumGoDurationNanoseconds = 9_223_372_036_854_775_807n;
const durationUnitNanoseconds: Readonly<Record<string, bigint>> = {
	ns: 1n,
	us: 1_000n,
	µs: 1_000n,
	μs: 1_000n,
	ms: 1_000_000n,
	s: 1_000_000_000n,
	m: 60_000_000_000n,
	h: 3_600_000_000_000n,
};

function durationFitsGoRange(value: string): boolean {
	if (value === '0') return true;
	let total = 0n;
	for (const match of value.matchAll(/(\d+)(?:\.(\d+))?(ns|us|µs|μs|ms|s|m|h)/gu)) {
		const fraction = match[2] ?? '';
		const scale = 10n ** BigInt(fraction.length);
		const numerator = BigInt(match[1] ?? '0') * scale + BigInt(fraction || '0');
		const unit = durationUnitNanoseconds[match[3] ?? ''];
		if (unit === undefined) return false;
		total += numerator * unit / scale;
		if (total > maximumGoDurationNanoseconds) return false;
	}
	return true;
}

const uuid = v.pipe(
	v.string(),
	v.minLength(1, 'SMTP server identifier is required.'),
	v.maxLength(128, 'SMTP server identifier is too long.'),
);
const shortText = v.pipe(v.string(), v.maxLength(255));
const duration = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, 'Enter a duration.'),
	v.maxLength(64, 'Duration is too long.'),
	v.regex(
		new RegExp(`^${GO_DURATION_HTML_PATTERN}$`, 'u'),
		'Use a Go duration such as 500ms, 15m, 1h, or 1h30m.',
	),
	v.check(durationFitsGoRange, 'Duration exceeds Listmonk’s supported range.'),
);
// Listmonk leaves these empty while their feature toggle is off. The owning
// schema requires a real value only when the matching toggle is on.
const optionalDuration = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(64, 'Duration is too long.'),
	v.check(
		(value) => value === '' || new RegExp(`^${GO_DURATION_HTML_PATTERN}$`, 'u').test(value),
		'Use a Go duration such as 500ms, 15m, 1h, or 1h30m.',
	),
	v.check(
		(value) => value === '' || durationFitsGoRange(value),
		'Duration exceeds Listmonk’s supported range.',
	),
);
const optionalCronSchedule = v.pipe(v.string(), v.trim(), v.maxLength(100));
const port = v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(65_535));
const boundedInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(10_000));
const fromAddress = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(255));
const notificationEmail = v.pipe(v.string(), v.trim(), v.email('Enter a valid notification email.'), v.maxLength(320));
const domain = v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a domain.'), v.maxLength(255));
const publicUrl = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(300),
	v.check((value) => {
		if (!value) return true;
		try {
			const parsed = new URL(value);
			return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
		} catch {
			return false;
		}
	}, 'Enter an HTTP(S) URL without credentials.'),
);
const performanceInteger = (minimum: number, maximum: number) => v.pipe(
	v.number(),
	v.safeInteger('Enter a whole number.'),
	v.minValue(minimum),
	v.maxValue(maximum),
);

export const SmtpAuthProtocolSchema = v.picklist(['login', 'cram', 'plain', 'none'] as const);
export const SmtpTlsTypeSchema = v.picklist(['TLS', 'STARTTLS', 'none'] as const);

const smtpEditableEntries = {
	uuid,
	name: v.pipe(v.string(), v.maxLength(100)),
	enabled: v.boolean(),
	host: shortText,
	port,
	authProtocol: SmtpAuthProtocolSchema,
	username: v.pipe(v.string(), v.maxLength(1_000)),
	helloHostname: shortText,
	maxConnections: v.pipe(boundedInteger, v.minValue(1)),
	maxMessageRetries: v.pipe(boundedInteger, v.maxValue(1_000)),
	messageRetryDelay: duration,
	idleTimeout: duration,
	waitTimeout: duration,
	tlsType: SmtpTlsTypeSchema,
	tlsSkipVerify: v.boolean(),
	fromAddresses: v.pipe(v.array(fromAddress), v.maxLength(100)),
};

export const SmtpServerSchema = v.strictObject({
	...smtpEditableEntries,
	hasPassword: v.boolean(),
});

export const EmailSettingsSchema = v.strictObject({
	smtp: v.pipe(v.array(SmtpServerSchema), v.maxLength(100)),
});

export const EmailGeneralSettingsSchema = v.strictObject({
	siteName: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter the site name.'), v.maxLength(300)),
	logoUrl: publicUrl,
	faviconUrl: publicUrl,
	fromEmail: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter the default from address.'), v.maxLength(1_000)),
	notifyEmails: v.pipe(v.array(notificationEmail), v.maxLength(100)),
	sendOptInConfirmation: v.boolean(),
	showOptInPage: v.boolean(),
	publicArchiveEnabled: v.boolean(),
	publicArchiveRssContentEnabled: v.boolean(),
	publicSubscriptionEnabled: v.boolean(),
	rootUrl: v.pipe(v.string(), v.maxLength(4_096)),
	bounceProcessingEnabled: v.boolean(),
	language: v.pipe(v.string(), v.maxLength(100)),
});

export const SaveEmailGeneralSettingsCommandSchema = v.strictObject({
	siteName: EmailGeneralSettingsSchema.entries.siteName,
	logoUrl: EmailGeneralSettingsSchema.entries.logoUrl,
	faviconUrl: EmailGeneralSettingsSchema.entries.faviconUrl,
	fromEmail: EmailGeneralSettingsSchema.entries.fromEmail,
	notifyEmails: EmailGeneralSettingsSchema.entries.notifyEmails,
	sendOptInConfirmation: v.boolean(),
	showOptInPage: v.boolean(),
	publicArchiveEnabled: v.boolean(),
	publicArchiveRssContentEnabled: v.boolean(),
});

export const EmailPerformanceSettingsSchema = v.pipe(
	v.strictObject({
		concurrency: performanceInteger(1, 10_000),
		messageRate: performanceInteger(1, 100_000),
		batchSize: performanceInteger(1, 100_000),
		maxSendErrors: performanceInteger(0, 100_000),
		slidingWindow: v.boolean(),
		slidingWindowRate: performanceInteger(0, 10_000_000),
		slidingWindowDuration: optionalDuration,
		cacheSlowQueries: v.boolean(),
		cacheSlowQueriesInterval: optionalCronSchedule,
	}),
	v.forward(
		v.check(
			(input) => !input.slidingWindow || input.slidingWindowDuration !== '',
			'Enter a duration.',
		),
		['slidingWindowDuration'],
	),
	v.forward(
		v.check(
			(input) => !input.cacheSlowQueries || input.cacheSlowQueriesInterval !== '',
			'Enter the five-field cron schedule.',
		),
		['cacheSlowQueriesInterval'],
	),
);

export const SaveEmailPerformanceSettingsCommandSchema = EmailPerformanceSettingsSchema;

export const BounceActionSchema = v.picklist(['none', 'unsubscribe', 'blocklist', 'delete'] as const);
const bounceRule = v.strictObject({
	count: performanceInteger(1, 1_000),
	action: BounceActionSchema,
});
const bounceActions = {
	soft: bounceRule,
	hard: bounceRule,
	complaint: bounceRule,
};
const hasSecret = v.boolean();
const secretChange = v.nullable(v.pipe(v.string(), v.minLength(1, 'Enter the replacement secret.'), v.maxLength(10_000)));
const bounceMailboxEntries = {
	uuid,
	enabled: v.boolean(),
	type: v.literal('pop'),
	host: v.pipe(v.string(), v.trim(), v.maxLength(255)),
	port,
	authProtocol: v.picklist(['none', 'userpass'] as const),
	username: v.pipe(v.string(), v.maxLength(1_000)),
	tlsEnabled: v.boolean(),
	tlsSkipVerify: v.boolean(),
	scanInterval: duration,
};
export const BounceMailboxSchema = v.strictObject({ ...bounceMailboxEntries, hasPassword: hasSecret });
const SaveBounceMailboxSchema = v.strictObject({ ...bounceMailboxEntries, password: secretChange });

export const EmailBounceSettingsSchema = v.strictObject({
	enabled: v.boolean(),
	actions: v.strictObject(bounceActions),
	webhooksEnabled: v.boolean(),
	sesEnabled: v.boolean(),
	azure: v.strictObject({ enabled: v.boolean(), hasSharedSecret: hasSecret, sharedSecretHeader: v.pipe(v.string(), v.maxLength(255)) }),
	sendgrid: v.strictObject({ enabled: v.boolean(), hasKey: hasSecret }),
	postmark: v.strictObject({ enabled: v.boolean(), username: v.pipe(v.string(), v.maxLength(1_000)), hasPassword: hasSecret }),
	forwardEmail: v.strictObject({ enabled: v.boolean(), hasKey: hasSecret }),
	lettermint: v.strictObject({ enabled: v.boolean(), hasKey: hasSecret }),
	mailboxes: v.pipe(v.array(BounceMailboxSchema), v.maxLength(100)),
});

export const SaveEmailBounceSettingsCommandSchema = v.strictObject({
	enabled: v.boolean(),
	actions: v.strictObject(bounceActions),
	webhooksEnabled: v.boolean(),
	sesEnabled: v.boolean(),
	azure: v.strictObject({ enabled: v.boolean(), sharedSecret: secretChange, sharedSecretHeader: v.pipe(v.string(), v.trim(), v.maxLength(255)) }),
	sendgrid: v.strictObject({ enabled: v.boolean(), key: secretChange }),
	postmark: v.strictObject({ enabled: v.boolean(), username: v.pipe(v.string(), v.trim(), v.maxLength(1_000)), password: secretChange }),
	forwardEmail: v.strictObject({ enabled: v.boolean(), key: secretChange }),
	lettermint: v.strictObject({ enabled: v.boolean(), key: secretChange }),
	mailboxes: v.pipe(v.array(SaveBounceMailboxSchema), v.maxLength(100)),
	acknowledgeDelete: v.boolean(),
});

export const EmailExportFieldSchema = v.picklist(['profile', 'subscriptions', 'campaign_views', 'link_clicks'] as const);

export const EmailPrivacyPolicySchema = v.strictObject({
	disableTracking: v.boolean(),
	individualTracking: v.boolean(),
	unsubscribeHeader: v.boolean(),
	recordOptInIp: v.boolean(),
	allowBlocklist: v.boolean(),
	allowPreferences: v.boolean(),
	allowExport: v.boolean(),
	exportable: v.pipe(v.array(EmailExportFieldSchema), v.maxLength(4)),
	allowWipe: v.boolean(),
	domainBlocklist: v.pipe(v.array(domain), v.maxLength(1_000)),
	domainAllowlist: v.pipe(v.array(domain), v.maxLength(1_000)),
});

export const SaveEmailPrivacyPolicyCommandSchema = EmailPrivacyPolicySchema;

export const SaveEmailSettingsCommandSchema = v.strictObject({
	servers: v.pipe(
		v.array(v.strictObject({
			...smtpEditableEntries,
			password: v.nullable(v.pipe(v.string(), v.maxLength(10_000))),
		})),
		v.minLength(1, 'Configure at least one SMTP server.'),
		v.maxLength(100),
	),
});

export const TestSmtpCommandSchema = v.strictObject({
	server: v.strictObject({
		...smtpEditableEntries,
		password: v.pipe(v.string(), v.maxLength(10_000)),
	}),
	recipient: v.pipe(v.string(), v.trim(), v.email('Enter a valid recipient email.'), v.maxLength(320)),
});

export const EmailSettingsCapabilitySchema = v.picklist(['view', 'edit'] as const);

export type EmailSettings = v.InferOutput<typeof EmailSettingsSchema>;
export type EmailGeneralSettings = v.InferOutput<typeof EmailGeneralSettingsSchema>;
export type SaveEmailGeneralSettingsCommand = v.InferInput<typeof SaveEmailGeneralSettingsCommandSchema>;
export type EmailPerformanceSettings = v.InferOutput<typeof EmailPerformanceSettingsSchema>;
export type SaveEmailPerformanceSettingsCommand = v.InferInput<typeof SaveEmailPerformanceSettingsCommandSchema>;
export type EmailBounceSettings = v.InferOutput<typeof EmailBounceSettingsSchema>;
export type SaveEmailBounceSettingsCommand = v.InferInput<typeof SaveEmailBounceSettingsCommandSchema>;
export type BounceMailbox = v.InferOutput<typeof BounceMailboxSchema>;
export type EmailExportField = v.InferOutput<typeof EmailExportFieldSchema>;
export type EmailPrivacyPolicy = v.InferOutput<typeof EmailPrivacyPolicySchema>;
export type SaveEmailPrivacyPolicyCommand = v.InferInput<typeof SaveEmailPrivacyPolicyCommandSchema>;
export type EmailSettingsCapability = v.InferOutput<typeof EmailSettingsCapabilitySchema>;
export type SmtpServer = v.InferOutput<typeof SmtpServerSchema>;
export type SaveEmailSettingsCommand = v.InferInput<typeof SaveEmailSettingsCommandSchema>;
export type TestSmtpCommand = v.InferInput<typeof TestSmtpCommandSchema>;

export type SaveEmailSettingsResult = { needsRestart: boolean };

export class EmailSettingsProviderFailure extends Error {
	constructor(public readonly status: number) {
		super(`Listmonk settings request failed with status ${status}.`);
		this.name = 'EmailSettingsProviderFailure';
	}
}

export function isEmailSettingsProviderFailure(error: unknown): error is EmailSettingsProviderFailure {
	return typeof error === 'object' && error !== null && Reflect.get(error, 'name') === 'EmailSettingsProviderFailure'
		&& typeof Reflect.get(error, 'status') === 'number';
}
