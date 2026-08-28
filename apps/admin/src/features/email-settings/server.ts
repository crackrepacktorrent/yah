import { query } from '@solidjs/router';
import type {
	EmailBounceSettings,
	EmailGeneralSettings,
	EmailPerformanceSettings,
	EmailPrivacyPolicy,
	EmailSettings,
	EmailSettingsCapability,
	SaveEmailBounceSettingsCommand,
	SaveEmailGeneralSettingsCommand,
	SaveEmailPerformanceSettingsCommand,
	SaveEmailPrivacyPolicyCommand,
	SaveEmailSettingsCommand,
	SaveEmailSettingsResult,
	TestSmtpCommand,
} from './contracts';
import {
	readAuthorizedEmailBounceSettings,
	readAuthorizedEmailGeneralSettings,
	readAuthorizedEmailPerformanceSettings,
	readAuthorizedEmailPrivacyPolicy,
	readAuthorizedEmailSettings,
	requireAuthorizedEmailSettingsCapability,
	saveAuthorizedEmailBounceSettings,
	saveAuthorizedEmailGeneralSettings,
	saveAuthorizedEmailPerformanceSettings,
	saveAuthorizedEmailPrivacyPolicy,
	saveAuthorizedEmailSettings,
	testAuthorizedSmtp,
} from './service';
import { runProductionRequest } from '~/platform/production-request.server';

async function requestDependencies(headers: Headers) {
	const [{ createAuthorizationContext }, { productionEmailSettingsManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-email-settings-manager.server'),
	]);
	return { authorization: createAuthorizationContext(headers), manager: productionEmailSettingsManager };
}

export const getEmailSettings = query(async (): Promise<EmailSettings> => {
	'use server';
	return runProductionRequest(async (request) => readAuthorizedEmailSettings(await requestDependencies(request.headers)));
}, 'email-settings');

export const getEmailGeneralSettings = query(async (): Promise<EmailGeneralSettings> => {
	'use server';
	return runProductionRequest(async (request) => readAuthorizedEmailGeneralSettings(await requestDependencies(request.headers)));
}, 'email-general-settings');

export const getEmailPerformanceSettings = query(async (): Promise<EmailPerformanceSettings> => {
	'use server';
	return runProductionRequest(async (request) =>
		readAuthorizedEmailPerformanceSettings(await requestDependencies(request.headers)),
	);
}, 'email-performance-settings');

export const getEmailBounceSettings = query(async (): Promise<EmailBounceSettings> => {
	'use server';
	return runProductionRequest(async (request) => readAuthorizedEmailBounceSettings(await requestDependencies(request.headers)));
}, 'email-bounce-settings');

export const getEmailPrivacyPolicy = query(async (): Promise<EmailPrivacyPolicy> => {
	'use server';
	return runProductionRequest(async (request) => readAuthorizedEmailPrivacyPolicy(await requestDependencies(request.headers)));
}, 'email-privacy-policy');

export const requireEmailSettingsCapability = query(async (capability: EmailSettingsCapability): Promise<true> => {
	'use server';
	return runProductionRequest(async (request) =>
		requireAuthorizedEmailSettingsCapability(capability, await requestDependencies(request.headers)),
	);
}, 'email-settings-capability');

export async function saveEmailSettings(command: SaveEmailSettingsCommand): Promise<SaveEmailSettingsResult> {
	'use server';
	return runProductionRequest(async (request) => saveAuthorizedEmailSettings(command, await requestDependencies(request.headers)));
}

export async function saveEmailGeneralSettings(command: SaveEmailGeneralSettingsCommand): Promise<SaveEmailSettingsResult> {
	'use server';
	return runProductionRequest(async (request) =>
		saveAuthorizedEmailGeneralSettings(command, await requestDependencies(request.headers)),
	);
}

export async function saveEmailPerformanceSettings(command: SaveEmailPerformanceSettingsCommand): Promise<SaveEmailSettingsResult> {
	'use server';
	return runProductionRequest(async (request) =>
		saveAuthorizedEmailPerformanceSettings(command, await requestDependencies(request.headers)),
	);
}

export async function saveEmailBounceSettings(command: SaveEmailBounceSettingsCommand): Promise<SaveEmailSettingsResult> {
	'use server';
	return runProductionRequest(async (request) =>
		saveAuthorizedEmailBounceSettings(command, await requestDependencies(request.headers)),
	);
}

export async function saveEmailPrivacyPolicy(command: SaveEmailPrivacyPolicyCommand): Promise<SaveEmailSettingsResult> {
	'use server';
	return runProductionRequest(async (request) =>
		saveAuthorizedEmailPrivacyPolicy(command, await requestDependencies(request.headers)),
	);
}

export async function testSmtp(command: TestSmtpCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) => testAuthorizedSmtp(command, await requestDependencies(request.headers)));
}
