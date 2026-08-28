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
import { surfaceError } from '~/platform/errors';
import { getServerRequest } from '~/platform/request';
import { requireProductionRuntime } from '~/platform/runtime.server';

async function dependencies() {
	const [{ enforcePermissions }, { productionEmailSettingsManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-email-settings-manager.server'),
	]);
	return { enforcePermissions, manager: productionEmailSettingsManager };
}

export const getEmailSettings = query(async (): Promise<EmailSettings> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await readAuthorizedEmailSettings(request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'email-settings');

export const getEmailGeneralSettings = query(async (): Promise<EmailGeneralSettings> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await readAuthorizedEmailGeneralSettings(request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'email-general-settings');

export const getEmailPerformanceSettings = query(async (): Promise<EmailPerformanceSettings> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await readAuthorizedEmailPerformanceSettings(request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'email-performance-settings');

export const getEmailBounceSettings = query(async (): Promise<EmailBounceSettings> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await readAuthorizedEmailBounceSettings(request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'email-bounce-settings');

export const getEmailPrivacyPolicy = query(async (): Promise<EmailPrivacyPolicy> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await readAuthorizedEmailPrivacyPolicy(request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'email-privacy-policy');

export const requireEmailSettingsCapability = query(async (capability: EmailSettingsCapability): Promise<true> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await requireAuthorizedEmailSettingsCapability(capability, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'email-settings-capability');

export async function saveEmailSettings(command: SaveEmailSettingsCommand): Promise<SaveEmailSettingsResult> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await saveAuthorizedEmailSettings(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function saveEmailGeneralSettings(command: SaveEmailGeneralSettingsCommand): Promise<SaveEmailSettingsResult> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await saveAuthorizedEmailGeneralSettings(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function saveEmailPerformanceSettings(command: SaveEmailPerformanceSettingsCommand): Promise<SaveEmailSettingsResult> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await saveAuthorizedEmailPerformanceSettings(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function saveEmailBounceSettings(command: SaveEmailBounceSettingsCommand): Promise<SaveEmailSettingsResult> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await saveAuthorizedEmailBounceSettings(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function saveEmailPrivacyPolicy(command: SaveEmailPrivacyPolicyCommand): Promise<SaveEmailSettingsResult> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await saveAuthorizedEmailPrivacyPolicy(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}

export async function testSmtp(command: TestSmtpCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await testAuthorizedSmtp(command, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}
