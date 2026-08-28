import { describe, expect, it, vi } from 'vitest';
import { createListmonkEmailSettingsManager } from './email-settings-manager.server';
import { createListmonkV62SettingsFixture } from './listmonk-settings-document.fixture';
import { prepareMaskedSettingsForWrite } from './listmonk-settings-document.server';

const config = { LISTMONK_URL: 'https://mail.example/', LISTMONK_API_TOKEN: 'admin:secret-token' };
const uuid = '10000000-0000-4000-8000-000000000001';
const providerServer = {
	uuid,
	name: 'email-primary',
	enabled: true,
	host: 'smtp.example.test',
	port: 587,
	auth_protocol: 'login',
	username: 'mailer',
	password: '••••••••',
	email_headers: [{ 'X-Provider': 'keep-me' }],
	hello_hostname: '',
	max_conns: 10,
	max_msg_retries: 2,
	msg_retry_delay: '10ms',
	idle_timeout: '15s',
	wait_timeout: '5s',
	tls_type: 'STARTTLS',
	tls_skip_verify: false,
	from_addresses: ['example.test'],
};
const commandServer = {
	uuid,
	name: 'email-primary',
	enabled: true,
	host: 'smtp2.example.test',
	port: 587,
	authProtocol: 'login' as const,
	username: 'mailer',
	password: null,
	helloHostname: '',
	maxConnections: 12,
	maxMessageRetries: 2,
	messageRetryDelay: '10ms',
	idleTimeout: '15s',
	waitTimeout: '5s',
	tlsType: 'STARTTLS' as const,
	tlsSkipVerify: false,
	fromAddresses: ['example.test'],
};
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
describe('Listmonk email settings manager', () => {
	it('exposes only password presence, not Listmonk’s length-revealing mask', async () => {
		const manager = createListmonkEmailSettingsManager(config, vi.fn(async () => json({ data: { smtp: [providerServer] } })));
		await expect(manager.read()).resolves.toEqual({ smtp: [{
			uuid,
			name: 'email-primary',
			enabled: true,
			host: 'smtp.example.test',
			port: 587,
			authProtocol: 'login',
			username: 'mailer',
			hasPassword: true,
			helloHostname: '',
			maxConnections: 10,
			maxMessageRetries: 2,
			messageRetryDelay: '10ms',
			idleTimeout: '15s',
			waitTimeout: '5s',
			tlsType: 'STARTTLS',
			tlsSkipVerify: false,
			fromAddresses: ['example.test'],
		}] });
	});

	it('accepts passwordless SMTP entries when Listmonk omits the optional password field', async () => {
		const { password: _password, ...passwordlessServer } = providerServer;
		const manager = createListmonkEmailSettingsManager(config, vi.fn(async () => json({
			data: { smtp: [{ ...passwordlessServer, auth_protocol: 'none', username: '' }] },
		})));
		await expect(manager.read()).resolves.toMatchObject({ smtp: [{
			authProtocol: 'none',
			hasPassword: false,
			username: '',
		}] });
	});

	it('fails closed with a recovery path when provider records do not yet have stable identifiers', async () => {
		const blankSmtp = { ...providerServer, uuid: '' };
		const reader = createListmonkEmailSettingsManager(config, vi.fn(async () => json({ data: { smtp: [blankSmtp] } })));
		await expect(reader.read()).rejects.toThrow('save them once in the private Listmonk operator UI');

		const blankMailboxDocument = createListmonkV62SettingsFixture();
		blankMailboxDocument['bounce.mailboxes'] = [{
			...(blankMailboxDocument['bounce.mailboxes'] as Record<string, unknown>[])[0],
			uuid: '',
		}];
		const bounceReader = createListmonkEmailSettingsManager(config, vi.fn(async () => json({ data: blankMailboxDocument })));
		await expect(bounceReader.readBounces()).rejects.toThrow('save them once in the private Listmonk operator UI');

		const blankSmtpDocument = { ...createListmonkV62SettingsFixture(), smtp: [blankSmtp] };
		const request = vi.fn(async () => json({ data: blankSmtpDocument }));
		const writer = createListmonkEmailSettingsManager(config, request);
		await expect(writer.saveGeneral({
			siteName: 'YAH Updates', logoUrl: '', faviconUrl: '', fromEmail: 'YAH <hello@example.test>',
			notifyEmails: [], sendOptInConfirmation: true, showOptInPage: true,
			publicArchiveEnabled: false, publicArchiveRssContentEnabled: false,
		})).rejects.toThrow('save them once in the private Listmonk operator UI');
		expect(request).toHaveBeenCalledOnce();
	});

	it('does one fresh GET-merge-PUT, preserves unknown fields, and empties only known masks', async () => {
		const current = {
			...createListmonkV62SettingsFixture(),
			smtp: [providerServer],
			'appearance.admin.custom_css': 'body::after { content: "••"; }',
			'bounce.postmark': { enabled: true, username: 'postmark', password: '••••' },
		};
		const request = vi.fn(async (_input: string | URL, init: RequestInit = {}) =>
			init.method === 'PUT' ? json({ data: true }) : json({ data: current }),
		);
		const manager = createListmonkEmailSettingsManager(config, request);
		await expect(manager.save({ servers: [commandServer] })).resolves.toEqual({ needsRestart: false });

		expect(request).toHaveBeenCalledTimes(2);
		expect(request.mock.calls.map(([input, init]) => [String(input), init?.method])).toEqual([
			['https://mail.example/api/settings', undefined],
			['https://mail.example/api/settings', 'PUT'],
		]);
		const body = JSON.parse(String(request.mock.calls[1]?.[1]?.body));
		expect(body['app.lang']).toBe('en');
		expect(body['appearance.admin.custom_css']).toContain('••');
		expect(body['bounce.postmark'].password).toBe('');
		expect(body.smtp[0]).toMatchObject({ host: 'smtp2.example.test', password: '', max_conns: 12 });
		expect(body.smtp[0].email_headers).toEqual([{ 'X-Provider': 'keep-me' }]);
	});

	it('surfaces deferred restart acknowledgement and permits auth-none tests without a password', async () => {
		const request = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
			if (String(input).endsWith('/settings/smtp/test')) return json({ data: ['diagnostic line'] });
			if (init.method === 'PUT') return json({ data: { needs_restart: true } });
			return json({ data: { ...createListmonkV62SettingsFixture(), smtp: [providerServer] } });
		});
		const manager = createListmonkEmailSettingsManager(config, request);
		await expect(manager.save({ servers: [commandServer] })).resolves.toEqual({ needsRestart: true });
		await expect(manager.test({
			server: { ...commandServer, authProtocol: 'none', username: '', password: '' },
			recipient: 'owner@example.test',
		})).resolves.toBeUndefined();
		const testBody = JSON.parse(String(request.mock.calls[2]?.[1]?.body));
		expect(testBody).toMatchObject({ auth_protocol: 'none', password: '', email: 'owner@example.test' });
	});

	it('rejects unmasked passwords and new authenticated servers without a password', async () => {
		const leaked = createListmonkEmailSettingsManager(config, vi.fn(async () => json({
			data: { smtp: [{ ...providerServer, password: 'plaintext' }] },
		})));
		await expect(leaked.read()).rejects.toThrow('unmasked SMTP password');

		const manager = createListmonkEmailSettingsManager(config, vi.fn(async () => json({ data: { ...createListmonkV62SettingsFixture(), smtp: [providerServer] } })));
		await expect(manager.save({ servers: [{ ...commandServer, uuid: crypto.randomUUID() }] }))
			.rejects.toMatchObject({ name: 'EmailSettingsProviderFailure', status: 400 });

		const passwordless = createListmonkEmailSettingsManager(config, vi.fn(async () => json({
			data: { ...createListmonkV62SettingsFixture(), smtp: [{ ...providerServer, password: '' }] },
		})));
		await expect(passwordless.save({ servers: [commandServer] }))
			.rejects.toMatchObject({ name: 'EmailSettingsProviderFailure', status: 400 });
	});

	it('does not clear a non-secret field made only of bullets', () => {
		expect(prepareMaskedSettingsForWrite({ 'app.site_name': '•••', 'bounce.sendgrid_key': '•••' }))
			.toEqual({ 'app.site_name': '•••', 'bounce.sendgrid_key': '' });
	});

	it('reads general, performance, bounce, and privacy projections without exposing the raw document', async () => {
		const manager = createListmonkEmailSettingsManager(config, vi.fn(async () => json({ data: { ...createListmonkV62SettingsFixture(), smtp: [providerServer] } })));
		await expect(manager.readGeneral()).resolves.toEqual({
			siteName: 'YAH mail',
			logoUrl: '',
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
		});
		await expect(manager.readPerformance()).resolves.toEqual({
			concurrency: 2, messageRate: 10, batchSize: 1_000, maxSendErrors: 1_000,
			slidingWindow: false, slidingWindowRate: 0, slidingWindowDuration: '1m',
			cacheSlowQueries: false, cacheSlowQueriesInterval: '0 0 * * *',
		});
		await expect(manager.readBounces()).resolves.toMatchObject({
			enabled: true,
			webhooksEnabled: true,
			azure: { enabled: false, hasSharedSecret: true, sharedSecretHeader: 'x-bounce-secret' },
			mailboxes: [{ uuid: '30000000-0000-4000-8000-000000000003', hasPassword: true }],
		});
		await expect(manager.readPrivacy()).resolves.toEqual({
			disableTracking: false,
			individualTracking: true,
			unsubscribeHeader: true,
			recordOptInIp: false,
			allowBlocklist: true,
			allowPreferences: true,
			allowExport: true,
			exportable: ['profile', 'subscriptions', 'campaign_views', 'link_clicks'],
			allowWipe: true,
			domainBlocklist: ['blocked.example'],
			domainAllowlist: [],
		});
	});

	it('serializes concurrent full-document writes and preserves both feature-owned patches', async () => {
		let current: Record<string, unknown> = {
			...createListmonkV62SettingsFixture(),
			smtp: [providerServer],
			'appearance.admin.custom_css': 'body::after { content: "••"; }',
			'bounce.postmark': { enabled: true, username: 'postmark', password: '••••' },
		};
		const bodies: Record<string, unknown>[] = [];
		const request = vi.fn(async (_input: string | URL, init: RequestInit = {}) => {
			if (init.method === 'PUT') {
				current = JSON.parse(String(init.body)) as Record<string, unknown>;
				bodies.push(current);
				return json({ data: true });
			}
			return json({ data: current });
		});
		const generalManager = createListmonkEmailSettingsManager(config, request);
		const privacyManager = createListmonkEmailSettingsManager(config, request);
		await Promise.all([
			generalManager.saveGeneral({
				siteName: 'YAH Updates', logoUrl: 'https://example.test/logo.png', faviconUrl: '',
				fromEmail: 'YAH Updates <updates@example.test>', notifyEmails: ['new@example.test'], sendOptInConfirmation: false,
				showOptInPage: false, publicArchiveEnabled: true, publicArchiveRssContentEnabled: true,
			}),
			privacyManager.savePrivacy({
				disableTracking: true, individualTracking: false, unsubscribeHeader: false, recordOptInIp: true,
				allowBlocklist: false, allowPreferences: false, allowExport: false, allowWipe: false,
				exportable: ['profile', 'subscriptions'],
				domainBlocklist: ['deny.example'], domainAllowlist: ['allow.example'],
			}),
		]);

		expect(request).toHaveBeenCalledTimes(4);
		expect(bodies[0]).toMatchObject({
			'app.from_email': 'YAH Updates <updates@example.test>',
			'app.notify_emails': ['new@example.test'],
			'app.send_optin_confirmation': false,
			'privacy.exportable': ['profile', 'subscriptions', 'campaign_views', 'link_clicks'],
		});
		const generalBody = bodies[0];
		expect(generalBody).toBeDefined();
		if (!generalBody) throw new Error('Expected one general settings write.');
		expect(generalBody['smtp']).toEqual([{ ...providerServer, password: '' }]);
		expect((generalBody['bounce.postmark'] as Record<string, unknown>)['password']).toBe('');
		expect(bodies[1]).toMatchObject({
			'privacy.disable_tracking': true,
			'privacy.individual_tracking': false,
			'privacy.unsubscribe_header': false,
			'privacy.domain_blocklist': ['deny.example'],
			'privacy.domain_allowlist': ['allow.example'],
			'privacy.exportable': ['profile', 'subscriptions'],
		});
		expect(bodies[1]?.['app.from_email']).toBe('YAH Updates <updates@example.test>');
	});

	it('releases the process-wide queue after a failed document validation', async () => {
		const queueConfig = { ...config, LISTMONK_URL: 'https://queue.example/' };
		let reads = 0;
		let current = createListmonkV62SettingsFixture();
		const request = vi.fn(async (_input: string | URL, init: RequestInit = {}) => {
			if (init.method === 'PUT') {
				current = JSON.parse(String(init.body)) as Record<string, unknown>;
				return json({ data: true });
			}
			reads += 1;
			return reads === 1 ? json({ data: { smtp: [providerServer] } }) : json({ data: current });
		});
		const first = createListmonkEmailSettingsManager(queueConfig, request);
		const second = createListmonkEmailSettingsManager(queueConfig, request);
		const [failed, succeeded] = await Promise.allSettled([
			first.saveGeneral({
				siteName: 'YAH Updates', logoUrl: '', faviconUrl: '', fromEmail: 'YAH <hello@example.test>',
				notifyEmails: [], sendOptInConfirmation: true, showOptInPage: true,
				publicArchiveEnabled: false, publicArchiveRssContentEnabled: false,
			}),
			second.savePrivacy({
				disableTracking: true, individualTracking: false, unsubscribeHeader: true, recordOptInIp: false,
				allowBlocklist: true, allowPreferences: true, allowExport: true, allowWipe: true,
				exportable: ['profile'], domainBlocklist: [], domainAllowlist: [],
			}),
		]);

		expect(failed.status).toBe('rejected');
		expect(succeeded).toEqual({ status: 'fulfilled', value: { needsRestart: false } });
		expect(request.mock.calls.map(([, init]) => init?.method ?? 'GET')).toEqual(['GET', 'GET', 'PUT']);
		expect(current['privacy.disable_tracking']).toBe(true);
	});

	it('writes complete performance and bounce controls while retaining secrets and mailbox-owned fields', async () => {
		const current = createListmonkV62SettingsFixture();
		const bodies: Record<string, unknown>[] = [];
		const request = vi.fn(async (_input: string | URL, init: RequestInit = {}) => {
			if (init.method === 'PUT') {
				bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
				return json({ data: true });
			}
			return json({ data: current });
		});
		const manager = createListmonkEmailSettingsManager(config, request);
		await manager.savePerformance({
			concurrency: 3, messageRate: 12, batchSize: 800, maxSendErrors: 900,
			slidingWindow: true, slidingWindowRate: 500, slidingWindowDuration: '1h',
			cacheSlowQueries: true, cacheSlowQueriesInterval: '0 4 * * *',
		});
		await manager.saveBounces({
			enabled: true,
			actions: {
				soft: { count: 4, action: 'unsubscribe' }, hard: { count: 1, action: 'blocklist' }, complaint: { count: 1, action: 'delete' },
			},
			webhooksEnabled: true,
			sesEnabled: true,
			azure: { enabled: true, sharedSecret: null, sharedSecretHeader: 'x-yah-bounce' },
			sendgrid: { enabled: true, key: 'replacement-sendgrid-key' },
			postmark: { enabled: true, username: 'postmark-user', password: null },
			forwardEmail: { enabled: true, key: null },
			lettermint: { enabled: true, key: null },
			mailboxes: [{
				uuid: '30000000-0000-4000-8000-000000000003', enabled: true, type: 'pop', host: 'pop2.example.test', port: 995,
				authProtocol: 'userpass', username: 'bounce', password: null, tlsEnabled: true, tlsSkipVerify: false, scanInterval: '20m',
			}],
			acknowledgeDelete: true,
		});

		expect(bodies).toHaveLength(2);
		expect(bodies[0]).toMatchObject({
			'app.concurrency': 3, 'app.message_rate': 12, 'app.batch_size': 800, 'app.max_send_errors': 900,
			'app.message_sliding_window': true, 'app.cache_slow_queries': true,
		});
		expect(bodies[1]).toMatchObject({
			'bounce.enabled': true,
			'bounce.ses_enabled': true,
			'bounce.sendgrid_enabled': true,
			'bounce.sendgrid_key': 'replacement-sendgrid-key',
			'bounce.azure': { enabled: true, shared_secret: '', shared_secret_header: 'x-yah-bounce' },
			'bounce.postmark': { enabled: true, username: 'postmark-user', password: '' },
		});
		const mailboxes = bodies[1]?.['bounce.mailboxes'];
		expect(mailboxes).toEqual([expect.objectContaining({
			uuid: '30000000-0000-4000-8000-000000000003', host: 'pop2.example.test', password: '', return_path: 'bounce@example.test',
		})]);
	});

	it('rejects enabling bounce integrations without a replacement or saved credential', async () => {
		const current = createListmonkV62SettingsFixture();
		current['bounce.sendgrid_key'] = '';
		const manager = createListmonkEmailSettingsManager(config, vi.fn(async () => json({ data: current })));
		await expect(manager.saveBounces({
			enabled: true,
			actions: {
				soft: { count: 3, action: 'none' }, hard: { count: 1, action: 'blocklist' }, complaint: { count: 1, action: 'blocklist' },
			},
			webhooksEnabled: true,
			sesEnabled: false,
			azure: { enabled: false, sharedSecret: null, sharedSecretHeader: '' },
			sendgrid: { enabled: true, key: null },
			postmark: { enabled: false, username: '', password: null },
			forwardEmail: { enabled: false, key: null },
			lettermint: { enabled: false, key: null },
			mailboxes: [],
			acknowledgeDelete: false,
		})).rejects.toMatchObject({ name: 'EmailSettingsProviderFailure', status: 400 });
	});
});
