import 'server-only';
import * as v from 'valibot';
import {
	EmailBounceSettingsSchema,
	EmailGeneralSettingsSchema,
	EmailPerformanceSettingsSchema,
	EmailPrivacyPolicySchema,
	EmailSettingsProviderFailure,
	type BounceMailbox,
	type EmailBounceSettings,
	type EmailGeneralSettings,
	type EmailPerformanceSettings,
	type EmailPrivacyPolicy,
	type EmailSettings,
	type SmtpServer,
} from '~/features/email-settings/contracts';
import type { EmailSettingsManager } from '~/features/email-settings/service';
import type { ProductionConfig } from '~/platform/config/production';
import { validateListmonkV62SettingsDocument } from './listmonk-settings-document.server';
import { createListmonkTransport, ListmonkHttpFailure, type ListmonkRequest } from './transport.server';

const MAX_SMTP_SERVERS = 100;
const maskPattern = /^•+$/u;
const settingsEnvelopeSchema = v.object({
	data: v.record(v.string(), v.unknown()),
});
const smtpDtoSchema = v.object({
	uuid: v.pipe(v.string(), v.maxLength(128)),
	name: v.pipe(v.string(), v.maxLength(100)),
	enabled: v.boolean(),
	host: v.pipe(v.string(), v.maxLength(255)),
	port: v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(65_535)),
	auth_protocol: v.picklist(['login', 'cram', 'plain', 'none'] as const),
	username: v.pipe(v.string(), v.maxLength(1_000)),
	password: v.optional(v.pipe(v.string(), v.maxLength(10_000)), ''),
	hello_hostname: v.pipe(v.string(), v.maxLength(255)),
	max_conns: v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(10_000)),
	max_msg_retries: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(1_000)),
	msg_retry_delay: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
	idle_timeout: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
	wait_timeout: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
	tls_type: v.picklist(['TLS', 'STARTTLS', 'none'] as const),
	tls_skip_verify: v.boolean(),
	from_addresses: v.pipe(v.array(v.pipe(v.string(), v.maxLength(255))), v.maxLength(100)),
});
const settingsAckSchema = v.object({
	data: v.union([
		v.literal(true),
		v.object({ needs_restart: v.literal(true) }),
	]),
});
const smtpTestAckSchema = v.object({
	data: v.pipe(v.array(v.pipe(v.string(), v.maxLength(20_000))), v.maxLength(5_000)),
});

type SettingsDocument = Record<string, unknown>;
type SmtpDto = v.InferOutput<typeof smtpDtoSchema>;
type ListmonkConfig = Pick<ProductionConfig, 'LISTMONK_URL' | 'LISTMONK_API_TOKEN'>;
const settingsWriteQueues = new Map<string, Promise<void>>();

async function serializeSettingsWrite<T>(key: string, operation: () => Promise<T>): Promise<T> {
	const previous = settingsWriteQueues.get(key) ?? Promise.resolve();
	const run = previous.catch(() => undefined).then(operation);
	const settled = run.then(() => undefined, () => undefined);
	settingsWriteQueues.set(key, settled);
	try {
		return await run;
	} finally {
		if (settingsWriteQueues.get(key) === settled) settingsWriteQueues.delete(key);
	}
}

function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
	schema: TSchema,
	input: unknown,
	label: string,
): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, input);
	if (!result.success) throw new Error(`Listmonk returned an invalid ${label} response.`);
	return result.output;
}

function parseSettingsDocument(input: unknown): SettingsDocument {
	return parse(settingsEnvelopeSchema, input, 'settings').data;
}

function parseSmtp(document: SettingsDocument): SmtpDto[] {
	const smtp = parse(v.pipe(v.array(smtpDtoSchema), v.maxLength(MAX_SMTP_SERVERS)), document['smtp'], 'SMTP settings');
	assertStableIdentifiers(document, ['smtp']);
	for (const server of smtp) {
		if (server.password !== '' && !maskPattern.test(server.password)) {
			throw new Error('Listmonk returned an unmasked SMTP password.');
		}
	}
	return smtp;
}

function parseGeneral(document: SettingsDocument): EmailGeneralSettings {
	return parse(EmailGeneralSettingsSchema, {
		siteName: document['app.site_name'],
		logoUrl: document['app.logo_url'],
		faviconUrl: document['app.favicon_url'],
		fromEmail: document['app.from_email'],
		notifyEmails: document['app.notify_emails'],
		sendOptInConfirmation: document['app.send_optin_confirmation'],
		showOptInPage: document['app.show_optin_page'],
		publicArchiveEnabled: document['app.enable_public_archive'],
		publicArchiveRssContentEnabled: document['app.enable_public_archive_rss_content'],
		publicSubscriptionEnabled: document['app.enable_public_subscription_page'],
		rootUrl: document['app.root_url'],
		bounceProcessingEnabled: document['bounce.enabled'],
		language: document['app.lang'],
	}, 'general email settings');
}

function parsePerformance(document: SettingsDocument): EmailPerformanceSettings {
	return parse(EmailPerformanceSettingsSchema, {
		concurrency: document['app.concurrency'],
		messageRate: document['app.message_rate'],
		batchSize: document['app.batch_size'],
		maxSendErrors: document['app.max_send_errors'],
		slidingWindow: document['app.message_sliding_window'],
		slidingWindowRate: document['app.message_sliding_window_rate'],
		slidingWindowDuration: document['app.message_sliding_window_duration'],
		cacheSlowQueries: document['app.cache_slow_queries'],
		cacheSlowQueriesInterval: document['app.cache_slow_queries_interval'],
	}, 'email performance settings');
}

function parsePrivacy(document: SettingsDocument): EmailPrivacyPolicy {
	return parse(EmailPrivacyPolicySchema, {
		disableTracking: document['privacy.disable_tracking'],
		individualTracking: document['privacy.individual_tracking'],
		unsubscribeHeader: document['privacy.unsubscribe_header'],
		recordOptInIp: document['privacy.record_optin_ip'],
		allowBlocklist: document['privacy.allow_blocklist'],
		allowPreferences: document['privacy.allow_preferences'],
		allowExport: document['privacy.allow_export'],
		exportable: document['privacy.exportable'],
		allowWipe: document['privacy.allow_wipe'],
		domainBlocklist: document['privacy.domain_blocklist'],
		domainAllowlist: document['privacy.domain_allowlist'],
	}, 'privacy settings');
}

function normalize(server: SmtpDto): SmtpServer {
	return {
		uuid: server.uuid,
		name: server.name,
		enabled: server.enabled,
		host: server.host,
		port: server.port,
		authProtocol: server.auth_protocol,
		username: server.username,
		hasPassword: server.password.length > 0,
		helloHostname: server.hello_hostname,
		maxConnections: server.max_conns,
		maxMessageRetries: server.max_msg_retries,
		messageRetryDelay: server.msg_retry_delay,
		idleTimeout: server.idle_timeout,
		waitTimeout: server.wait_timeout,
		tlsType: server.tls_type,
		tlsSkipVerify: server.tls_skip_verify,
		fromAddresses: server.from_addresses,
	};
}

function secretPresent(value: unknown): boolean {
	return typeof value === 'string' && value.length > 0;
}

function normalizeMailbox(input: Record<string, unknown>): BounceMailbox {
	return parse(EmailBounceSettingsSchema.entries.mailboxes.item, {
		uuid: input['uuid'],
		enabled: input['enabled'],
		type: input['type'],
		host: input['host'],
		port: input['port'],
		authProtocol: input['auth_protocol'],
		username: input['username'],
		hasPassword: secretPresent(input['password']),
		tlsEnabled: input['tls_enabled'],
		tlsSkipVerify: input['tls_skip_verify'],
		scanInterval: input['scan_interval'],
	}, 'bounce mailbox');
}

function nestedRecord(document: SettingsDocument, key: string): Record<string, unknown> {
	const value = document[key];
	if (!isRecord(value)) throw new Error(`Listmonk returned invalid ${key} settings.`);
	return value;
}

function parseBounces(document: SettingsDocument): EmailBounceSettings {
	const azure = nestedRecord(document, 'bounce.azure');
	const postmark = nestedRecord(document, 'bounce.postmark');
	const forwardEmail = nestedRecord(document, 'bounce.forwardemail');
	const lettermint = nestedRecord(document, 'bounce.lettermint');
	const rawMailboxes = document['bounce.mailboxes'];
	if (!Array.isArray(rawMailboxes) || rawMailboxes.some((mailbox) => !isRecord(mailbox))) {
		throw new Error('Listmonk returned invalid bounce mailbox settings.');
	}
	assertStableIdentifiers(document, ['bounce.mailboxes']);
	return parse(EmailBounceSettingsSchema, {
		enabled: document['bounce.enabled'],
		actions: document['bounce.actions'],
		webhooksEnabled: document['bounce.webhooks_enabled'],
		sesEnabled: document['bounce.ses_enabled'],
		azure: { enabled: azure['enabled'], hasSharedSecret: secretPresent(azure['shared_secret']), sharedSecretHeader: azure['shared_secret_header'] },
		sendgrid: { enabled: document['bounce.sendgrid_enabled'], hasKey: secretPresent(document['bounce.sendgrid_key']) },
		postmark: { enabled: postmark['enabled'], username: postmark['username'], hasPassword: secretPresent(postmark['password']) },
		forwardEmail: { enabled: forwardEmail['enabled'], hasKey: secretPresent(forwardEmail['key']) },
		lettermint: { enabled: lettermint['enabled'], hasKey: secretPresent(lettermint['key']) },
		mailboxes: rawMailboxes.map(normalizeMailbox),
	}, 'bounce settings');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertStableIdentifiers(
	document: SettingsDocument,
	collections: readonly string[] = ['smtp', 'bounce.mailboxes', 'messengers'],
): void {
	for (const collectionKey of collections) {
		const collection = document[collectionKey];
		if (!Array.isArray(collection)) continue;
		const identifiers = collection.map((item) => isRecord(item) ? item['uuid'] : undefined);
		if (identifiers.some((identifier) => typeof identifier !== 'string' || identifier.length === 0)) {
			throw new Error(`Listmonk ${collectionKey} entries need stable identifiers. Re-enter their credentials and save them once in the private Listmonk operator UI before using YAH settings.`);
		}
		if (new Set(identifiers).size !== identifiers.length) {
			throw new Error(`Listmonk returned duplicate ${collectionKey} identifiers.`);
		}
	}
}

function emptyMaskedProperty(record: Record<string, unknown>, key: string): void {
	const value = record[key];
	if (typeof value === 'string' && maskPattern.test(value)) record[key] = '';
}

function emptyNestedMaskedProperty(document: SettingsDocument, path: readonly string[]): void {
	let record: Record<string, unknown> = document;
	for (const segment of path.slice(0, -1)) {
		const nested = record[segment];
		if (!isRecord(nested)) return;
		record = nested;
	}
	const key = path.at(-1);
	if (key) emptyMaskedProperty(record, key);
}

/** Only clear fields that Listmonk v6.2 itself masks and preserves on full PUT. */
export function prepareMaskedSettingsForWrite(input: SettingsDocument): SettingsDocument {
	const document = structuredClone(input);
	for (const collectionKey of ['smtp', 'bounce.mailboxes', 'messengers']) {
		const collection = document[collectionKey];
		if (!Array.isArray(collection)) continue;
		for (const item of collection) if (isRecord(item)) emptyMaskedProperty(item, 'password');
	}
	for (const path of [
		['upload.s3.aws_secret_access_key'],
		['bounce.sendgrid_key'],
		['bounce.azure', 'shared_secret'],
		['bounce.postmark', 'password'],
		['bounce.forwardemail', 'key'],
		['bounce.lettermint', 'key'],
		['security.captcha', 'hcaptcha', 'secret'],
		['security.oidc', 'client_secret'],
	] as const) emptyNestedMaskedProperty(document, path);
	return document;
}

function providerFailure(error: unknown): never {
	if (error instanceof ListmonkHttpFailure) throw new EmailSettingsProviderFailure(error.status);
	throw error;
}

function upstreamServer(command: Parameters<EmailSettingsManager['save']>[0]['servers'][number], current?: Record<string, unknown>) {
	if (command.password === null && command.authProtocol !== 'none'
		&& (!current || typeof current['password'] !== 'string' || current['password'] === '')) {
		throw new EmailSettingsProviderFailure(400);
	}
	return {
		...(current ?? { email_headers: [] }),
		uuid: command.uuid,
		name: command.name,
		enabled: command.enabled,
		host: command.host,
		port: command.port,
		auth_protocol: command.authProtocol,
		username: command.username,
		password: command.password ?? '',
		hello_hostname: command.helloHostname,
		max_conns: command.maxConnections,
		max_msg_retries: command.maxMessageRetries,
		msg_retry_delay: command.messageRetryDelay,
		idle_timeout: command.idleTimeout,
		wait_timeout: command.waitTimeout,
		tls_type: command.tlsType,
		tls_skip_verify: command.tlsSkipVerify,
		from_addresses: command.fromAddresses,
	};
}

function upstreamBounceMailbox(
	command: Parameters<EmailSettingsManager['saveBounces']>[0]['mailboxes'][number],
	current?: Record<string, unknown>,
) {
	if (command.enabled && command.password === null && command.authProtocol !== 'none'
		&& (!current || !secretPresent(current['password']))) {
		throw new EmailSettingsProviderFailure(400);
	}
	return {
		...(current ?? { return_path: '' }),
		uuid: command.uuid,
		enabled: command.enabled,
		type: command.type,
		host: command.host,
		port: command.port,
		auth_protocol: command.authProtocol,
		username: command.username,
		password: command.password ?? '',
		tls_enabled: command.tlsEnabled,
		tls_skip_verify: command.tlsSkipVerify,
		scan_interval: command.scanInterval,
	};
}

function requireReplacementOrSavedSecret(replacement: string | null, current: unknown): void {
	if (replacement === null && !secretPresent(current)) throw new EmailSettingsProviderFailure(400);
}

export function createListmonkEmailSettingsManager(
	config: ListmonkConfig,
	request?: ListmonkRequest,
): EmailSettingsManager {
	const transport = createListmonkTransport(config, request);

	async function currentSettings(): Promise<SettingsDocument> {
		return parseSettingsDocument(await transport.json('/settings'));
	}

	async function writeSettings(
		update: (document: SettingsDocument, current: SettingsDocument) => void,
	): Promise<{ needsRestart: boolean }> {
		return serializeSettingsWrite(config.LISTMONK_URL, async () => {
			const current = validateListmonkV62SettingsDocument(await currentSettings());
			assertStableIdentifiers(current);
			const writable = prepareMaskedSettingsForWrite(current);
			update(writable, current);
			const response = parse(settingsAckSchema, await transport.json('/settings', {
				method: 'PUT',
				body: JSON.stringify(writable),
			}), 'updated settings');
			return { needsRestart: response.data !== true };
		});
	}

	return {
		async read(): Promise<EmailSettings> {
			try {
				const smtp = parseSmtp(await currentSettings());
				return { smtp: smtp.map(normalize) };
			} catch (error) {
				providerFailure(error);
			}
		},
		async save(command) {
			try {
				return await writeSettings((writable, document) => {
					const smtp = parseSmtp(document);
					const rawByUuid = new Map<string, Record<string, unknown>>();
					for (const raw of document['smtp'] as unknown[]) {
						if (isRecord(raw) && typeof raw['uuid'] === 'string') rawByUuid.set(raw['uuid'], raw);
					}
					if (rawByUuid.size !== smtp.length) throw new Error('Listmonk returned duplicate SMTP identifiers.');
					writable['smtp'] = command.servers.map((server) => upstreamServer(server, rawByUuid.get(server.uuid)));
				});
			} catch (error) {
				providerFailure(error);
			}
		},
		async test(command): Promise<void> {
			try {
				parse(smtpTestAckSchema, await transport.json('/settings/smtp/test', {
					method: 'POST',
					body: JSON.stringify({
						...upstreamServer({ ...command.server, password: command.server.password }),
						email_headers: {},
						email: command.recipient,
					}),
				}), 'SMTP test');
			} catch (error) {
				providerFailure(error);
			}
		},
		async readGeneral(): Promise<EmailGeneralSettings> {
			try {
				return parseGeneral(await currentSettings());
			} catch (error) {
				providerFailure(error);
			}
		},
		async saveGeneral(command) {
			try {
				return await writeSettings((document) => {
					document['app.site_name'] = command.siteName;
					document['app.logo_url'] = command.logoUrl;
					document['app.favicon_url'] = command.faviconUrl;
					document['app.from_email'] = command.fromEmail;
					document['app.notify_emails'] = command.notifyEmails;
					document['app.send_optin_confirmation'] = command.sendOptInConfirmation;
					document['app.show_optin_page'] = command.showOptInPage;
					document['app.enable_public_archive'] = command.publicArchiveEnabled;
					document['app.enable_public_archive_rss_content'] = command.publicArchiveRssContentEnabled;
				});
			} catch (error) {
				providerFailure(error);
			}
		},
		async readPerformance(): Promise<EmailPerformanceSettings> {
			try {
				return parsePerformance(await currentSettings());
			} catch (error) {
				providerFailure(error);
			}
		},
		async savePerformance(command) {
			try {
				return await writeSettings((document) => {
					document['app.concurrency'] = command.concurrency;
					document['app.message_rate'] = command.messageRate;
					document['app.batch_size'] = command.batchSize;
					document['app.max_send_errors'] = command.maxSendErrors;
					document['app.message_sliding_window'] = command.slidingWindow;
					document['app.message_sliding_window_rate'] = command.slidingWindowRate;
					document['app.message_sliding_window_duration'] = command.slidingWindowDuration;
					document['app.cache_slow_queries'] = command.cacheSlowQueries;
					document['app.cache_slow_queries_interval'] = command.cacheSlowQueriesInterval;
				});
			} catch (error) {
				providerFailure(error);
			}
		},
		async readBounces(): Promise<EmailBounceSettings> {
			try {
				return parseBounces(await currentSettings());
			} catch (error) {
				providerFailure(error);
			}
		},
		async saveBounces(command) {
			try {
				return await writeSettings((writable, document) => {
					const currentMailboxes = document['bounce.mailboxes'];
					if (!Array.isArray(currentMailboxes) || currentMailboxes.some((mailbox) => !isRecord(mailbox))) {
						throw new Error('Listmonk returned invalid bounce mailbox settings.');
					}
					const rawByUuid = new Map<string, Record<string, unknown>>();
					for (const mailbox of currentMailboxes) {
						if (typeof mailbox['uuid'] === 'string') rawByUuid.set(mailbox['uuid'], mailbox);
					}
					if (rawByUuid.size !== currentMailboxes.length) throw new Error('Listmonk returned duplicate bounce mailbox identifiers.');
					const azure = nestedRecord(document, 'bounce.azure');
					const postmark = nestedRecord(document, 'bounce.postmark');
					const forwardEmail = nestedRecord(document, 'bounce.forwardemail');
					const lettermint = nestedRecord(document, 'bounce.lettermint');
					if (command.azure.enabled) requireReplacementOrSavedSecret(command.azure.sharedSecret, azure['shared_secret']);
					if (command.sendgrid.enabled) requireReplacementOrSavedSecret(command.sendgrid.key, document['bounce.sendgrid_key']);
					if (command.postmark.enabled) requireReplacementOrSavedSecret(command.postmark.password, postmark['password']);
					if (command.forwardEmail.enabled) requireReplacementOrSavedSecret(command.forwardEmail.key, forwardEmail['key']);
					if (command.lettermint.enabled) requireReplacementOrSavedSecret(command.lettermint.key, lettermint['key']);
					writable['bounce.enabled'] = command.enabled;
					writable['bounce.actions'] = command.actions;
					writable['bounce.webhooks_enabled'] = command.webhooksEnabled;
					writable['bounce.ses_enabled'] = command.sesEnabled;
					writable['bounce.azure'] = {
						...azure,
						enabled: command.azure.enabled,
						shared_secret: command.azure.sharedSecret === null ? '' : command.azure.sharedSecret,
						shared_secret_header: command.azure.sharedSecretHeader,
					};
					writable['bounce.sendgrid_enabled'] = command.sendgrid.enabled;
					writable['bounce.sendgrid_key'] = command.sendgrid.key === null ? '' : command.sendgrid.key;
					writable['bounce.postmark'] = {
						...postmark,
						enabled: command.postmark.enabled,
						username: command.postmark.username,
						password: command.postmark.password === null ? '' : command.postmark.password,
					};
					writable['bounce.forwardemail'] = { ...forwardEmail, enabled: command.forwardEmail.enabled, key: command.forwardEmail.key === null ? '' : command.forwardEmail.key };
					writable['bounce.lettermint'] = { ...lettermint, enabled: command.lettermint.enabled, key: command.lettermint.key === null ? '' : command.lettermint.key };
					writable['bounce.mailboxes'] = command.mailboxes.map((mailbox) => upstreamBounceMailbox(mailbox, rawByUuid.get(mailbox.uuid)));
				});
			} catch (error) {
				providerFailure(error);
			}
		},
		async readPrivacy(): Promise<EmailPrivacyPolicy> {
			try {
				return parsePrivacy(await currentSettings());
			} catch (error) {
				providerFailure(error);
			}
		},
		async savePrivacy(command) {
			try {
				return await writeSettings((document) => {
					document['privacy.disable_tracking'] = command.disableTracking;
					document['privacy.individual_tracking'] = command.individualTracking;
					document['privacy.unsubscribe_header'] = command.unsubscribeHeader;
					document['privacy.record_optin_ip'] = command.recordOptInIp;
					document['privacy.allow_blocklist'] = command.allowBlocklist;
					document['privacy.allow_preferences'] = command.allowPreferences;
					document['privacy.allow_export'] = command.allowExport;
					document['privacy.exportable'] = command.exportable;
					document['privacy.allow_wipe'] = command.allowWipe;
					document['privacy.domain_blocklist'] = command.domainBlocklist;
					document['privacy.domain_allowlist'] = command.domainAllowlist;
				});
			} catch (error) {
				providerFailure(error);
			}
		},
	};
}
