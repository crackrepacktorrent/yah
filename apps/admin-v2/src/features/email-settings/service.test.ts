import { describe, expect, it, vi } from 'vitest';
import type { EmailSettingsServiceDependencies } from './service';
import {
	readAuthorizedEmailBounceSettings,
	readAuthorizedEmailGeneralSettings,
	readAuthorizedEmailPerformanceSettings,
	readAuthorizedEmailPrivacyPolicy,
	readAuthorizedEmailSettings,
	saveAuthorizedEmailBounceSettings,
	saveAuthorizedEmailGeneralSettings,
	saveAuthorizedEmailPerformanceSettings,
	saveAuthorizedEmailPrivacyPolicy,
	saveAuthorizedEmailSettings,
	testAuthorizedSmtp,
} from './service';

const server = {
	uuid: '10000000-0000-4000-8000-000000000001',
	name: 'email-primary',
	enabled: true,
	host: 'smtp.example.test',
	port: 587,
	authProtocol: 'login' as const,
	username: 'mailer',
	helloHostname: '',
	maxConnections: 10,
	maxMessageRetries: 2,
	messageRetryDelay: '10ms',
	idleTimeout: '15s',
	waitTimeout: '5s',
	tlsType: 'STARTTLS' as const,
	tlsSkipVerify: false,
	fromAddresses: ['example.test'],
};

const general = {
	siteName: 'YAH mail',
	logoUrl: 'https://example.test/logo.png',
	faviconUrl: '',
	fromEmail: 'YAH <hello@example.test>',
	notifyEmails: ['operator@example.test'],
	sendOptInConfirmation: true,
	showOptInPage: true,
	publicArchiveEnabled: false,
	publicArchiveRssContentEnabled: false,
	publicSubscriptionEnabled: true,
	rootUrl: 'https://mail.example.test',
	bounceProcessingEnabled: true,
	language: 'en',
};

const performance = {
	concurrency: 2, messageRate: 10, batchSize: 1_000, maxSendErrors: 100,
	slidingWindow: false, slidingWindowRate: 0, slidingWindowDuration: '1h',
	cacheSlowQueries: false, cacheSlowQueriesInterval: '0 3 * * *',
};

const bounces = {
	enabled: true,
	actions: {
		soft: { count: 3, action: 'none' as const },
		hard: { count: 1, action: 'blocklist' as const },
		complaint: { count: 1, action: 'unsubscribe' as const },
	},
	webhooksEnabled: true,
	sesEnabled: false,
	azure: { enabled: false, hasSharedSecret: true, sharedSecretHeader: 'x-secret' },
	sendgrid: { enabled: false, hasKey: true },
	postmark: { enabled: false, username: '', hasPassword: true },
	forwardEmail: { enabled: false, hasKey: true },
	lettermint: { enabled: false, hasKey: true },
	mailboxes: [],
};

const privacy = {
	disableTracking: false,
	individualTracking: true,
	unsubscribeHeader: true,
	recordOptInIp: false,
	allowBlocklist: true,
	allowPreferences: true,
	allowExport: true,
	exportable: ['profile', 'subscriptions', 'campaign_views', 'link_clicks'] as Array<'profile' | 'subscriptions' | 'campaign_views' | 'link_clicks'>,
	allowWipe: true,
	domainBlocklist: ['blocked.example'],
	domainAllowlist: [],
};
const generalCommand = {
	siteName: general.siteName,
	logoUrl: general.logoUrl,
	faviconUrl: general.faviconUrl,
	fromEmail: general.fromEmail,
	notifyEmails: general.notifyEmails,
	sendOptInConfirmation: general.sendOptInConfirmation,
	showOptInPage: general.showOptInPage,
	publicArchiveEnabled: general.publicArchiveEnabled,
	publicArchiveRssContentEnabled: general.publicArchiveRssContentEnabled,
};

const bounceCommand = {
	enabled: bounces.enabled,
	actions: bounces.actions,
	webhooksEnabled: bounces.webhooksEnabled,
	sesEnabled: bounces.sesEnabled,
	azure: { enabled: false, sharedSecret: null, sharedSecretHeader: 'x-secret' },
	sendgrid: { enabled: false, key: null },
	postmark: { enabled: false, username: '', password: null },
	forwardEmail: { enabled: false, key: null },
	lettermint: { enabled: false, key: null },
	mailboxes: [],
	acknowledgeDelete: false,
};

function dependencies(): EmailSettingsServiceDependencies {
	return {
		enforcePermissions: vi.fn(async () => undefined),
		manager: {
			read: vi.fn(async () => ({ smtp: [{ ...server, hasPassword: true }] })),
			save: vi.fn(async () => ({ needsRestart: false })),
			test: vi.fn(async () => undefined),
			readGeneral: vi.fn(async () => general),
			saveGeneral: vi.fn(async () => ({ needsRestart: false })),
			readPerformance: vi.fn(async () => performance),
			savePerformance: vi.fn(async () => ({ needsRestart: false })),
			readBounces: vi.fn(async () => bounces),
			saveBounces: vi.fn(async () => ({ needsRestart: false })),
			readPrivacy: vi.fn(async () => privacy),
			savePrivacy: vi.fn(async () => ({ needsRestart: false })),
		},
	};
}

describe('email settings service boundary', () => {
	it('separates ordinary settings edits from provider operations', async () => {
		const deps = dependencies();
		await readAuthorizedEmailSettings(new Headers(), deps);
		await readAuthorizedEmailGeneralSettings(new Headers(), deps);
		await readAuthorizedEmailPerformanceSettings(new Headers(), deps);
		await readAuthorizedEmailBounceSettings(new Headers(), deps);
		await readAuthorizedEmailPrivacyPolicy(new Headers(), deps);
		await saveAuthorizedEmailSettings({ servers: [{ ...server, password: null }] }, new Headers(), deps);
		await saveAuthorizedEmailGeneralSettings(generalCommand, new Headers(), deps);
		await saveAuthorizedEmailPerformanceSettings(performance, new Headers(), deps);
		await saveAuthorizedEmailBounceSettings(bounceCommand, new Headers(), deps);
		await saveAuthorizedEmailPrivacyPolicy(privacy, new Headers(), deps);
		await testAuthorizedSmtp({ server: { ...server, password: 'fresh-secret' }, recipient: 'owner@example.test' }, new Headers(), deps);

		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(1, expect.any(Headers), { settings: ['view'] });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(2, expect.any(Headers), { settings: ['view'] });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(4, expect.any(Headers), { settings: ['view'] });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(5, expect.any(Headers), { settings: ['view'] });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(6, expect.any(Headers), { provider: ['manage'] });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(7, expect.any(Headers), { settings: ['edit'] });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(8, expect.any(Headers), { provider: ['manage'] });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(9, expect.any(Headers), { provider: ['manage'] });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(10, expect.any(Headers), { settings: ['edit'] });
		expect(deps.enforcePermissions).toHaveBeenNthCalledWith(11, expect.any(Headers), { provider: ['manage'] });
	});

	it('validates before authorization and never permits all SMTP servers to be disabled', async () => {
		const deps = dependencies();
		await expect(saveAuthorizedEmailSettings({ servers: [{ ...server, enabled: false, password: null }] }, new Headers(), deps))
			.rejects.toThrow('Enable at least one');
		await expect(testAuthorizedSmtp({ server: { ...server, password: '' }, recipient: 'owner@example.test' }, new Headers(), deps))
			.rejects.toThrow('Re-enter');
		await expect(saveAuthorizedEmailSettings({
			servers: [{ ...server, password: null, messageRetryDelay: 'banana' }],
		}, new Headers(), deps)).rejects.toThrow('Use a Go duration');
		expect(deps.enforcePermissions).not.toHaveBeenCalled();
		expect(deps.manager.save).not.toHaveBeenCalled();
		expect(deps.manager.test).not.toHaveBeenCalled();
	});

	it('accepts Go’s maximum duration and rejects numeric overflow before authorization', async () => {
		const maximum = dependencies();
		await saveAuthorizedEmailSettings({
			servers: [{ ...server, password: null, messageRetryDelay: '2562047h47m16.854775807s' }],
		}, new Headers(), maximum);
		expect(maximum.manager.save).toHaveBeenCalledOnce();

		for (const messageRetryDelay of ['99999999h', '2562047h47m16.854775808s']) {
			const overflow = dependencies();
			await expect(saveAuthorizedEmailSettings({
				servers: [{ ...server, password: null, messageRetryDelay }],
			}, new Headers(), overflow)).rejects.toThrow('exceeds Listmonk’s supported range');
			expect(overflow.enforcePermissions).not.toHaveBeenCalled();
			expect(overflow.manager.save).not.toHaveBeenCalled();
		}
	});

	it('normalizes settings collections and rejects contradictory domain policy before authorization', async () => {
		const deps = dependencies();
		await saveAuthorizedEmailGeneralSettings({ ...generalCommand, notifyEmails: [' Operator@Example.test ', 'operator@example.test'] }, new Headers(), deps);
		expect(deps.manager.saveGeneral).toHaveBeenCalledWith(expect.objectContaining({ notifyEmails: ['Operator@Example.test'] }));
		await saveAuthorizedEmailPrivacyPolicy({
			...privacy,
			exportable: ['profile', 'profile', 'subscriptions'],
			domainBlocklist: [' BLOCKED.EXAMPLE ', 'blocked.example'],
		}, new Headers(), deps);
		expect(deps.manager.savePrivacy).toHaveBeenCalledWith(expect.objectContaining({
			exportable: ['profile', 'subscriptions'],
			domainBlocklist: ['blocked.example'],
		}));

		const rejected = dependencies();
		await expect(saveAuthorizedEmailPrivacyPolicy({ ...privacy, domainAllowlist: ['Blocked.Example'] }, new Headers(), rejected))
			.rejects.toThrow('cannot be both allowed and blocked');
		expect(rejected.enforcePermissions).not.toHaveBeenCalled();

		const missingExportScope = dependencies();
		await expect(saveAuthorizedEmailPrivacyPolicy({ ...privacy, exportable: [] }, new Headers(), missingExportScope))
			.rejects.toThrow('Select at least one data category');
		expect(missingExportScope.enforcePermissions).not.toHaveBeenCalled();
	});

	it('guards high-impact performance and bounce commands before provider authorization', async () => {
		const invalidPerformance = dependencies();
		await expect(saveAuthorizedEmailPerformanceSettings({ ...performance, slidingWindow: true, slidingWindowRate: 0 }, new Headers(), invalidPerformance))
			.rejects.toThrow('at least one message');
		expect(invalidPerformance.enforcePermissions).not.toHaveBeenCalled();

		const destructive = dependencies();
		await expect(saveAuthorizedEmailBounceSettings({
			...bounceCommand,
			actions: { ...bounceCommand.actions, hard: { count: 1, action: 'delete' } },
		}, new Headers(), destructive)).rejects.toThrow('Acknowledge');
		expect(destructive.enforcePermissions).not.toHaveBeenCalled();
		const authorizedDestructive = dependencies();
		await saveAuthorizedEmailBounceSettings({
			...bounceCommand,
			actions: { ...bounceCommand.actions, hard: { count: 1, action: 'delete' } },
			acknowledgeDelete: true,
		}, new Headers(), authorizedDestructive);
		expect(authorizedDestructive.enforcePermissions).toHaveBeenCalledWith(expect.any(Headers), {
			provider: ['manage'],
			subscriber: ['delete'],
		});

		const mailbox = {
			uuid: crypto.randomUUID(), enabled: true, type: 'pop' as const, host: ' pop.example.test ', port: 995,
			authProtocol: 'userpass' as const, username: 'bounce', password: null,
			tlsEnabled: false, tlsSkipVerify: true, scanInterval: '15m',
		};
		const valid = dependencies();
		await saveAuthorizedEmailBounceSettings({ ...bounceCommand, mailboxes: [mailbox] }, new Headers(), valid);
		expect(valid.enforcePermissions).toHaveBeenCalledWith(expect.any(Headers), { provider: ['manage'] });
		expect(valid.manager.saveBounces).toHaveBeenCalledWith(expect.objectContaining({
			mailboxes: [expect.objectContaining({ host: 'pop.example.test', tlsSkipVerify: false })],
		}));

		const tooFrequent = dependencies();
		await expect(saveAuthorizedEmailBounceSettings({ ...bounceCommand, mailboxes: [{ ...mailbox, enabled: false, scanInterval: '59s' }] }, new Headers(), tooFrequent))
			.rejects.toThrow('at least one minute');
		expect(tooFrequent.enforcePermissions).not.toHaveBeenCalled();

		const unsupportedDay = dependencies();
		await expect(saveAuthorizedEmailBounceSettings({
			...bounceCommand,
			mailboxes: [{ ...mailbox, enabled: false, scanInterval: '1d' }],
		}, new Headers(), unsupportedDay)).rejects.toThrow('Use a Go duration');
		expect(unsupportedDay.enforcePermissions).not.toHaveBeenCalled();
	});

	it('allows an auth-none SMTP test without a password', async () => {
		const deps = dependencies();
		await testAuthorizedSmtp({
			server: { ...server, authProtocol: 'none', username: '', password: '' },
			recipient: 'owner@example.test',
		}, new Headers(), deps);
		expect(deps.manager.test).toHaveBeenCalledOnce();
	});

	it('does not call Listmonk when authorization fails', async () => {
		const deps = dependencies();
		vi.mocked(deps.enforcePermissions).mockRejectedValue(new Error('Forbidden'));
		await expect(readAuthorizedEmailSettings(new Headers(), deps)).rejects.toThrow('Forbidden');
		await expect(saveAuthorizedEmailSettings({ servers: [{ ...server, password: null }] }, new Headers(), deps)).rejects.toThrow('Forbidden');
		expect(deps.manager.read).not.toHaveBeenCalled();
		expect(deps.manager.save).not.toHaveBeenCalled();
	});
});
