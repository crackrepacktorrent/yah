import {
	EmailBounceSettingsSchema,
	EmailSettingsProviderFailure,
	type BounceMailbox,
	type EmailBounceSettings,
	type SaveEmailBounceSettingsCommand,
} from '~/features/email-settings/contracts';
import {
	parseListmonkValue,
	settingsCollection,
	settingsRecord,
	settingsRecordsByUuid,
	type ListmonkSettingsDocument,
} from './listmonk-settings-protocol';
import { maskedSecretPresent } from './listmonk-settings-secret-policy';

type SaveBounceMailbox = SaveEmailBounceSettingsCommand['mailboxes'][number];

function projectMailbox(input: Record<string, unknown>): BounceMailbox {
	return parseListmonkValue(EmailBounceSettingsSchema.entries.mailboxes.item, {
		uuid: input['uuid'],
		enabled: input['enabled'],
		type: input['type'],
		host: input['host'],
		port: input['port'],
		authProtocol: input['auth_protocol'],
		username: input['username'],
		hasPassword: maskedSecretPresent(input['password'], 'bounce mailbox password'),
		tlsEnabled: input['tls_enabled'],
		tlsSkipVerify: input['tls_skip_verify'],
		scanInterval: input['scan_interval'],
	}, 'bounce mailbox');
}

function upstreamMailbox(
	mailbox: SaveBounceMailbox,
	current?: Record<string, unknown>,
): Record<string, unknown> {
	if (mailbox.enabled && mailbox.password === null && mailbox.authProtocol !== 'none'
		&& (!current || !maskedSecretPresent(current['password'], 'bounce mailbox password'))) {
		throw new EmailSettingsProviderFailure(400);
	}
	return {
		...(current ?? { return_path: '' }),
		uuid: mailbox.uuid,
		enabled: mailbox.enabled,
		type: mailbox.type,
		host: mailbox.host,
		port: mailbox.port,
		auth_protocol: mailbox.authProtocol,
		username: mailbox.username,
		password: mailbox.password ?? '',
		tls_enabled: mailbox.tlsEnabled,
		tls_skip_verify: mailbox.tlsSkipVerify,
		scan_interval: mailbox.scanInterval,
	};
}

function requireReplacementOrSavedSecret(
	replacement: string | null,
	current: unknown,
	label: string,
): void {
	if (replacement === null && !maskedSecretPresent(current, label)) {
		throw new EmailSettingsProviderFailure(400);
	}
}

export function projectEmailBounceSettings(
	document: ListmonkSettingsDocument,
): EmailBounceSettings {
	const azure = settingsRecord(document, 'bounce.azure');
	const postmark = settingsRecord(document, 'bounce.postmark');
	const forwardEmail = settingsRecord(document, 'bounce.forwardemail');
	const lettermint = settingsRecord(document, 'bounce.lettermint');
	const mailboxes = settingsCollection(document, 'bounce.mailboxes');
	settingsRecordsByUuid(document, 'bounce.mailboxes');
	return parseListmonkValue(EmailBounceSettingsSchema, {
		enabled: document['bounce.enabled'],
		actions: document['bounce.actions'],
		webhooksEnabled: document['bounce.webhooks_enabled'],
		sesEnabled: document['bounce.ses_enabled'],
		azure: {
			enabled: azure['enabled'],
			hasSharedSecret: maskedSecretPresent(azure['shared_secret'], 'Azure bounce shared secret'),
			sharedSecretHeader: azure['shared_secret_header'],
		},
		sendgrid: {
			enabled: document['bounce.sendgrid_enabled'],
			hasKey: maskedSecretPresent(document['bounce.sendgrid_key'], 'SendGrid bounce key'),
		},
		postmark: {
			enabled: postmark['enabled'],
			username: postmark['username'],
			hasPassword: maskedSecretPresent(postmark['password'], 'Postmark bounce password'),
		},
		forwardEmail: {
			enabled: forwardEmail['enabled'],
			hasKey: maskedSecretPresent(forwardEmail['key'], 'Forward Email bounce key'),
		},
		lettermint: {
			enabled: lettermint['enabled'],
			hasKey: maskedSecretPresent(lettermint['key'], 'Lettermint bounce key'),
		},
		mailboxes: mailboxes.map(projectMailbox),
	}, 'bounce settings');
}

export function applyEmailBounceSettingsPatch(
	writable: ListmonkSettingsDocument,
	current: ListmonkSettingsDocument,
	command: SaveEmailBounceSettingsCommand,
): void {
	const currentMailboxes = settingsRecordsByUuid(current, 'bounce.mailboxes');
	const azure = settingsRecord(current, 'bounce.azure');
	const postmark = settingsRecord(current, 'bounce.postmark');
	const forwardEmail = settingsRecord(current, 'bounce.forwardemail');
	const lettermint = settingsRecord(current, 'bounce.lettermint');
	if (command.azure.enabled) {
		requireReplacementOrSavedSecret(command.azure.sharedSecret, azure['shared_secret'], 'Azure bounce shared secret');
	}
	if (command.sendgrid.enabled) {
		requireReplacementOrSavedSecret(command.sendgrid.key, current['bounce.sendgrid_key'], 'SendGrid bounce key');
	}
	if (command.postmark.enabled) {
		requireReplacementOrSavedSecret(command.postmark.password, postmark['password'], 'Postmark bounce password');
	}
	if (command.forwardEmail.enabled) {
		requireReplacementOrSavedSecret(command.forwardEmail.key, forwardEmail['key'], 'Forward Email bounce key');
	}
	if (command.lettermint.enabled) {
		requireReplacementOrSavedSecret(command.lettermint.key, lettermint['key'], 'Lettermint bounce key');
	}
	writable['bounce.enabled'] = command.enabled;
	writable['bounce.actions'] = command.actions;
	writable['bounce.webhooks_enabled'] = command.webhooksEnabled;
	writable['bounce.ses_enabled'] = command.sesEnabled;
	writable['bounce.azure'] = {
		...azure,
		enabled: command.azure.enabled,
		shared_secret: command.azure.sharedSecret ?? '',
		shared_secret_header: command.azure.sharedSecretHeader,
	};
	writable['bounce.sendgrid_enabled'] = command.sendgrid.enabled;
	writable['bounce.sendgrid_key'] = command.sendgrid.key ?? '';
	writable['bounce.postmark'] = {
		...postmark,
		enabled: command.postmark.enabled,
		username: command.postmark.username,
		password: command.postmark.password ?? '',
	};
	writable['bounce.forwardemail'] = {
		...forwardEmail,
		enabled: command.forwardEmail.enabled,
		key: command.forwardEmail.key ?? '',
	};
	writable['bounce.lettermint'] = {
		...lettermint,
		enabled: command.lettermint.enabled,
		key: command.lettermint.key ?? '',
	};
	writable['bounce.mailboxes'] = command.mailboxes.map((mailbox) => (
		upstreamMailbox(mailbox, currentMailboxes.get(mailbox.uuid))
	));
}
