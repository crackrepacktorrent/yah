import 'server-only';

import {
	EmailGeneralSettingsSchema,
	type EmailGeneralSettings,
	type SaveEmailGeneralSettingsCommand,
} from '~/features/email-settings/contracts';
import {
	parseListmonkValue,
	type ListmonkSettingsDocument,
} from './listmonk-settings-protocol';

export function projectEmailGeneralSettings(
	document: ListmonkSettingsDocument,
): EmailGeneralSettings {
	return parseListmonkValue(EmailGeneralSettingsSchema, {
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

export function applyEmailGeneralSettingsPatch(
	document: ListmonkSettingsDocument,
	command: SaveEmailGeneralSettingsCommand,
): void {
	document['app.site_name'] = command.siteName;
	document['app.logo_url'] = command.logoUrl;
	document['app.favicon_url'] = command.faviconUrl;
	document['app.from_email'] = command.fromEmail;
	document['app.notify_emails'] = command.notifyEmails;
	document['app.send_optin_confirmation'] = command.sendOptInConfirmation;
	document['app.show_optin_page'] = command.showOptInPage;
	document['app.enable_public_archive'] = command.publicArchiveEnabled;
	document['app.enable_public_archive_rss_content'] = command.publicArchiveRssContentEnabled;
}
