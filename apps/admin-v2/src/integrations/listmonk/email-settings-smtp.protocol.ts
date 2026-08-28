import * as v from 'valibot';
import {
	EmailSettingsProviderFailure,
	type EmailSettings,
	type SaveEmailSettingsCommand,
	type TestSmtpCommand,
} from '~/features/email-settings/contracts';
import {
	parseListmonkValue,
	settingsRecordsByUuid,
	type ListmonkSettingsDocument,
} from './listmonk-settings-protocol';
import { maskedSecretPresent } from './listmonk-settings-secret-policy';

const MAX_SMTP_SERVERS = 100;
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
const smtpTestAckSchema = v.object({
	data: v.pipe(v.array(v.pipe(v.string(), v.maxLength(20_000))), v.maxLength(5_000)),
});

type SmtpDto = v.InferOutput<typeof smtpDtoSchema>;
type SaveSmtpServer = SaveEmailSettingsCommand['servers'][number];

function parseSmtp(document: ListmonkSettingsDocument): SmtpDto[] {
	const servers = parseListmonkValue(
		v.pipe(v.array(smtpDtoSchema), v.maxLength(MAX_SMTP_SERVERS)),
		document['smtp'],
		'SMTP settings',
	);
	settingsRecordsByUuid(document, 'smtp');
	for (const server of servers) maskedSecretPresent(server.password, 'SMTP password');
	return servers;
}

function upstreamServer(server: SaveSmtpServer, current?: Record<string, unknown>) {
	if (server.password === null && server.authProtocol !== 'none'
		&& (!current || !maskedSecretPresent(current['password'], 'SMTP password'))) {
		throw new EmailSettingsProviderFailure(400);
	}
	return {
		...(current ?? { email_headers: [] }),
		uuid: server.uuid,
		name: server.name,
		enabled: server.enabled,
		host: server.host,
		port: server.port,
		auth_protocol: server.authProtocol,
		username: server.username,
		password: server.password ?? '',
		hello_hostname: server.helloHostname,
		max_conns: server.maxConnections,
		max_msg_retries: server.maxMessageRetries,
		msg_retry_delay: server.messageRetryDelay,
		idle_timeout: server.idleTimeout,
		wait_timeout: server.waitTimeout,
		tls_type: server.tlsType,
		tls_skip_verify: server.tlsSkipVerify,
		from_addresses: server.fromAddresses,
	};
}

export function projectEmailSmtpSettings(document: ListmonkSettingsDocument): EmailSettings {
	return {
		smtp: parseSmtp(document).map((server) => ({
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
		})),
	};
}

export function applyEmailSmtpSettingsPatch(
	writable: ListmonkSettingsDocument,
	current: ListmonkSettingsDocument,
	command: SaveEmailSettingsCommand,
): void {
	const currentByUuid = settingsRecordsByUuid(current, 'smtp');
	parseSmtp(current);
	writable['smtp'] = command.servers.map((server) => upstreamServer(server, currentByUuid.get(server.uuid)));
}

export function createSmtpTestPayload(command: TestSmtpCommand): Record<string, unknown> {
	return {
		...upstreamServer({ ...command.server, password: command.server.password }),
		email_headers: {},
		email: command.recipient,
	};
}

export function parseSmtpTestAcknowledgement(input: unknown): void {
	parseListmonkValue(smtpTestAckSchema, input, 'SMTP test');
}
