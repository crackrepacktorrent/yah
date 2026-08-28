import 'server-only';
import { EmailSettingsProviderFailure } from '~/features/email-settings/contracts';
import type { EmailSettingsManager } from '~/features/email-settings/service';
import type { ProductionConfig } from '~/platform/config/production';
import {
	applyEmailBounceSettingsPatch,
	projectEmailBounceSettings,
} from './email-settings-bounce.protocol';
import {
	applyEmailGeneralSettingsPatch,
	projectEmailGeneralSettings,
} from './email-settings-general.protocol';
import {
	applyEmailPerformanceSettingsPatch,
	projectEmailPerformanceSettings,
} from './email-settings-performance.protocol';
import {
	applyEmailPrivacyPolicyPatch,
	projectEmailPrivacyPolicy,
} from './email-settings-privacy.protocol';
import {
	applyEmailSmtpSettingsPatch,
	createSmtpTestPayload,
	parseSmtpTestAcknowledgement,
	projectEmailSmtpSettings,
} from './email-settings-smtp.protocol';
import { createListmonkSettingsDocumentCoordinator } from './listmonk-settings-document.server';
import {
	createListmonkTransport,
	ListmonkHttpFailure,
	type ListmonkRequest,
} from './transport.server';

type ListmonkConfig = Pick<ProductionConfig, 'LISTMONK_URL' | 'LISTMONK_API_TOKEN'>;

function providerFailure(error: unknown): never {
	if (error instanceof ListmonkHttpFailure) throw new EmailSettingsProviderFailure(error.status);
	throw error;
}

async function surfaceProviderFailure<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		providerFailure(error);
	}
}

export function createListmonkEmailSettingsManager(
	config: ListmonkConfig,
	request?: ListmonkRequest,
): EmailSettingsManager {
	const transport = createListmonkTransport(config, request);
	const settings = createListmonkSettingsDocumentCoordinator(config.LISTMONK_URL, transport);

	return {
		read: () => surfaceProviderFailure(async () => projectEmailSmtpSettings(await settings.read())),
		save: (command) => surfaceProviderFailure(() => settings.write((writable, current) => {
			applyEmailSmtpSettingsPatch(writable, current, command);
		})),
		test: (command) => surfaceProviderFailure(async () => {
			parseSmtpTestAcknowledgement(await transport.json('/settings/smtp/test', {
				method: 'POST',
				body: JSON.stringify(createSmtpTestPayload(command)),
			}));
		}),
		readGeneral: () => surfaceProviderFailure(async () => projectEmailGeneralSettings(await settings.read())),
		saveGeneral: (command) => surfaceProviderFailure(() => settings.write((writable) => {
			applyEmailGeneralSettingsPatch(writable, command);
		})),
		readPerformance: () => surfaceProviderFailure(async () => projectEmailPerformanceSettings(await settings.read())),
		savePerformance: (command) => surfaceProviderFailure(() => settings.write((writable) => {
			applyEmailPerformanceSettingsPatch(writable, command);
		})),
		readBounces: () => surfaceProviderFailure(async () => projectEmailBounceSettings(await settings.read())),
		saveBounces: (command) => surfaceProviderFailure(() => settings.write((writable, current) => {
			applyEmailBounceSettingsPatch(writable, current, command);
		})),
		readPrivacy: () => surfaceProviderFailure(async () => projectEmailPrivacyPolicy(await settings.read())),
		savePrivacy: (command) => surfaceProviderFailure(() => settings.write((writable) => {
			applyEmailPrivacyPolicyPatch(writable, command);
		})),
	};
}
