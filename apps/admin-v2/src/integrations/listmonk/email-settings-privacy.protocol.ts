import 'server-only';

import {
	EmailPrivacyPolicySchema,
	type EmailPrivacyPolicy,
	type SaveEmailPrivacyPolicyCommand,
} from '~/features/email-settings/contracts';
import {
	parseListmonkValue,
	type ListmonkSettingsDocument,
} from './listmonk-settings-protocol';

export function projectEmailPrivacyPolicy(
	document: ListmonkSettingsDocument,
): EmailPrivacyPolicy {
	return parseListmonkValue(EmailPrivacyPolicySchema, {
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

export function applyEmailPrivacyPolicyPatch(
	document: ListmonkSettingsDocument,
	command: SaveEmailPrivacyPolicyCommand,
): void {
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
}
