import type { Permissions } from '@yah/admin-core/permissions';
import * as v from 'valibot';
import {
	EmailSettingsCapabilitySchema,
	SaveEmailBounceSettingsCommandSchema,
	SaveEmailGeneralSettingsCommandSchema,
	SaveEmailPerformanceSettingsCommandSchema,
	SaveEmailPrivacyPolicyCommandSchema,
	SaveEmailSettingsCommandSchema,
	TestSmtpCommandSchema,
	isEmailSettingsProviderFailure,
	type EmailBounceSettings,
	type EmailGeneralSettings,
	type EmailPerformanceSettings,
	type EmailPrivacyPolicy,
	type EmailSettings,
	type SaveEmailBounceSettingsCommand,
	type SaveEmailGeneralSettingsCommand,
	type SaveEmailPerformanceSettingsCommand,
	type SaveEmailPrivacyPolicyCommand,
	type SaveEmailSettingsCommand,
	type SaveEmailSettingsResult,
	type TestSmtpCommand,
} from './contracts';
import { createPublicError } from '~/platform/errors';

export type EmailSettingsManager = {
	read(): Promise<EmailSettings>;
	save(command: v.InferOutput<typeof SaveEmailSettingsCommandSchema>): Promise<SaveEmailSettingsResult>;
	test(command: v.InferOutput<typeof TestSmtpCommandSchema>): Promise<void>;
	readGeneral(): Promise<EmailGeneralSettings>;
	saveGeneral(command: v.InferOutput<typeof SaveEmailGeneralSettingsCommandSchema>): Promise<SaveEmailSettingsResult>;
	readPerformance(): Promise<EmailPerformanceSettings>;
	savePerformance(command: v.InferOutput<typeof SaveEmailPerformanceSettingsCommandSchema>): Promise<SaveEmailSettingsResult>;
	readBounces(): Promise<EmailBounceSettings>;
	saveBounces(command: v.InferOutput<typeof SaveEmailBounceSettingsCommandSchema>): Promise<SaveEmailSettingsResult>;
	readPrivacy(): Promise<EmailPrivacyPolicy>;
	savePrivacy(command: v.InferOutput<typeof SaveEmailPrivacyPolicyCommandSchema>): Promise<SaveEmailSettingsResult>;
};

export type EmailSettingsServiceDependencies = {
	enforcePermissions(headers: Headers, permissions: Permissions): Promise<void>;
	manager: EmailSettingsManager;
};

function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
	schema: TSchema,
	input: unknown,
): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, input);
	if (!result.success) throw createPublicError(result.issues[0]?.message ?? 'Invalid email settings data.', 400);
	return result.output;
}

async function authorize(headers: Headers, capability: 'view' | 'edit', dependencies: EmailSettingsServiceDependencies): Promise<void> {
	await dependencies.enforcePermissions(headers, { settings: [capability] });
}

function validateServers(command: v.InferOutput<typeof SaveEmailSettingsCommandSchema>): void {
	if (!command.servers.some((server) => server.enabled)) {
		throw createPublicError('Enable at least one SMTP server.', 400);
	}
	const identifiers = command.servers.map((server) => server.uuid).filter(Boolean);
	if (new Set(identifiers).size !== identifiers.length) {
		throw createPublicError('SMTP server identifiers must be unique.', 400);
	}
	for (const server of command.servers) {
		if (!server.host.trim()) throw createPublicError('Every SMTP server needs a host.', 400);
		if (server.authProtocol !== 'none' && server.password === '') {
			throw createPublicError('SMTP passwords cannot be cleared while authentication is enabled.', 400);
		}
	}
}

function surfaceMutationFailure(error: unknown, fallback: string): never {
	if (isEmailSettingsProviderFailure(error) && [400, 409, 422].includes(error.status)) {
		throw createPublicError(fallback, 400);
	}
	throw error;
}

export async function requireAuthorizedEmailSettingsCapability(
	input: unknown,
	headers: Headers,
	dependencies: EmailSettingsServiceDependencies,
): Promise<true> {
	const capability = parse(EmailSettingsCapabilitySchema, input);
	await authorize(headers, capability, dependencies);
	return true;
}

export async function readAuthorizedEmailSettings(
	headers: Headers,
	dependencies: EmailSettingsServiceDependencies,
): Promise<EmailSettings> {
	await authorize(headers, 'view', dependencies);
	return dependencies.manager.read();
}

export async function readAuthorizedEmailGeneralSettings(
	headers: Headers,
	dependencies: EmailSettingsServiceDependencies,
): Promise<EmailGeneralSettings> {
	await authorize(headers, 'view', dependencies);
	return dependencies.manager.readGeneral();
}

export async function readAuthorizedEmailPerformanceSettings(
	headers: Headers,
	dependencies: EmailSettingsServiceDependencies,
): Promise<EmailPerformanceSettings> {
	await authorize(headers, 'view', dependencies);
	return dependencies.manager.readPerformance();
}

export async function readAuthorizedEmailBounceSettings(
	headers: Headers,
	dependencies: EmailSettingsServiceDependencies,
): Promise<EmailBounceSettings> {
	await authorize(headers, 'view', dependencies);
	return dependencies.manager.readBounces();
}

export async function readAuthorizedEmailPrivacyPolicy(
	headers: Headers,
	dependencies: EmailSettingsServiceDependencies,
): Promise<EmailPrivacyPolicy> {
	await authorize(headers, 'view', dependencies);
	return dependencies.manager.readPrivacy();
}

function normalizedUnique(values: string[], lowerCase: boolean): string[] {
	const unique = new Map<string, string>();
	for (const raw of values) {
		const value = raw.trim();
		const key = value.toLowerCase();
		if (!unique.has(key)) unique.set(key, lowerCase ? key : value);
	}
	return [...unique.values()];
}

export async function saveAuthorizedEmailGeneralSettings(
	input: SaveEmailGeneralSettingsCommand,
	headers: Headers,
	dependencies: EmailSettingsServiceDependencies,
): Promise<SaveEmailSettingsResult> {
	const command = parse(SaveEmailGeneralSettingsCommandSchema, input);
	const normalized = {
		...command,
		notifyEmails: normalizedUnique(command.notifyEmails, false),
	};
	await authorize(headers, 'edit', dependencies);
	try {
		return await dependencies.manager.saveGeneral(normalized);
	} catch (error) {
		surfaceMutationFailure(error, 'Listmonk rejected the general email settings. Check the URLs, sender, and notification addresses.');
	}
}

export async function saveAuthorizedEmailPerformanceSettings(
	input: SaveEmailPerformanceSettingsCommand,
	headers: Headers,
	dependencies: EmailSettingsServiceDependencies,
): Promise<SaveEmailSettingsResult> {
	const command = parse(SaveEmailPerformanceSettingsCommandSchema, input);
	if (command.slidingWindow && command.slidingWindowRate < 1) {
		throw createPublicError('Enter at least one message for the enabled sliding window.', 400);
	}
	await dependencies.enforcePermissions(headers, { provider: ['manage'] });
	try {
		return await dependencies.manager.savePerformance(command);
	} catch (error) {
		surfaceMutationFailure(error, 'Listmonk rejected the delivery-performance settings.');
	}
}

function durationMilliseconds(value: string): number {
	if (value === '0') return 0;
	const factors: Record<string, number> = {
		ns: 0.000_001,
		us: 0.001,
		µs: 0.001,
		μs: 0.001,
		ms: 1,
		s: 1_000,
		m: 60_000,
		h: 3_600_000,
	};
	let total = 0;
	for (const part of value.matchAll(/(\d+(?:\.\d+)?)(ns|us|µs|μs|ms|s|m|h)/gu)) {
		total += Number(part[1]) * (factors[part[2] ?? ''] ?? 0);
	}
	return total;
}

export async function saveAuthorizedEmailBounceSettings(
	input: SaveEmailBounceSettingsCommand,
	headers: Headers,
	dependencies: EmailSettingsServiceDependencies,
): Promise<SaveEmailSettingsResult> {
	const command = parse(SaveEmailBounceSettingsCommandSchema, input);
	if (Object.values(command.actions).some(({ action }) => action === 'delete') && !command.acknowledgeDelete) {
		throw createPublicError('Acknowledge that the delete action permanently removes matching subscribers.', 400);
	}
	if (command.mailboxes.filter(({ enabled }) => enabled).length > 1) {
		throw createPublicError('Enable at most one bounce mailbox.', 400);
	}
	const identifiers = command.mailboxes.map(({ uuid: mailboxUuid }) => mailboxUuid).filter(Boolean);
	if (new Set(identifiers).size !== identifiers.length) throw createPublicError('Bounce mailbox identifiers must be unique.', 400);
	for (const mailbox of command.mailboxes) {
		if (mailbox.enabled && !mailbox.host) throw createPublicError('Every enabled bounce mailbox needs a host.', 400);
		if (durationMilliseconds(mailbox.scanInterval) < 60_000) {
			throw createPublicError('Bounce mailbox scan intervals must be at least one minute.', 400);
		}
	}
	const normalized = {
		...command,
		mailboxes: command.mailboxes.map((mailbox) => ({
			...mailbox,
			host: mailbox.host.trim(),
			tlsSkipVerify: mailbox.tlsEnabled && mailbox.tlsSkipVerify,
		})),
	};
	const permissions: Permissions = { provider: ['manage'] };
	if (Object.values(command.actions).some(({ action }) => action === 'delete')) permissions['subscriber'] = ['delete'];
	await dependencies.enforcePermissions(headers, permissions);
	try {
		return await dependencies.manager.saveBounces(normalized);
	} catch (error) {
		surfaceMutationFailure(error, 'Listmonk rejected the bounce-processing settings. Check enabled provider credentials and mailbox values.');
	}
}

export async function saveAuthorizedEmailPrivacyPolicy(
	input: SaveEmailPrivacyPolicyCommand,
	headers: Headers,
	dependencies: EmailSettingsServiceDependencies,
): Promise<SaveEmailSettingsResult> {
	const command = parse(SaveEmailPrivacyPolicyCommandSchema, input);
	const normalized = {
		...command,
		exportable: [...new Set(command.exportable)],
		domainBlocklist: normalizedUnique(command.domainBlocklist, true),
		domainAllowlist: normalizedUnique(command.domainAllowlist, true),
	};
	if (normalized.allowExport && normalized.exportable.length === 0) {
		throw createPublicError('Select at least one data category for recipient exports.', 400);
	}
	const overlap = normalized.domainBlocklist.find((domain) => normalized.domainAllowlist.includes(domain));
	if (overlap) throw createPublicError(`${overlap} cannot be both allowed and blocked.`, 400);
	await authorize(headers, 'edit', dependencies);
	try {
		return await dependencies.manager.savePrivacy(normalized);
	} catch (error) {
		surfaceMutationFailure(error, 'Listmonk rejected the privacy policy settings.');
	}
}

export async function saveAuthorizedEmailSettings(
	input: SaveEmailSettingsCommand,
	headers: Headers,
	dependencies: EmailSettingsServiceDependencies,
): Promise<SaveEmailSettingsResult> {
	const command = parse(SaveEmailSettingsCommandSchema, input);
	validateServers(command);
	await dependencies.enforcePermissions(headers, { provider: ['manage'] });
	try {
		return await dependencies.manager.save(command);
	} catch (error) {
		surfaceMutationFailure(error, 'Listmonk rejected the SMTP settings. Check the server values and try again.');
	}
}

export async function testAuthorizedSmtp(
	input: TestSmtpCommand,
	headers: Headers,
	dependencies: EmailSettingsServiceDependencies,
): Promise<void> {
	const command = parse(TestSmtpCommandSchema, input);
	if (!command.server.host.trim()) throw createPublicError('Enter the SMTP host before testing.', 400);
	if (command.server.authProtocol !== 'none' && !command.server.password) {
		throw createPublicError('Re-enter the SMTP password before testing this server.', 400);
	}
	await dependencies.enforcePermissions(headers, { provider: ['manage'] });
	try {
		await dependencies.manager.test(command);
	} catch (error) {
		surfaceMutationFailure(error, 'Listmonk could not complete the SMTP test. Check the connection settings.');
	}
}
