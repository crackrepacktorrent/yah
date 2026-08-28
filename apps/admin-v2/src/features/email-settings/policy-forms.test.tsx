import { createComponent, render } from '@solidjs/web';
import { flush } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmailBounceSettingsForm } from './bounce-form';
import { EmailGeneralSettingsForm } from './general-form';
import { EmailPerformanceSettingsForm } from './performance-form';
import { EmailPrivacyForm } from './privacy-form';

const disposers: Array<() => void> = [];
afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
});

function mount(component: Parameters<typeof render>[0]): HTMLDivElement {
	const container = document.createElement('div');
	document.body.append(container);
	disposers.push(() => container.remove(), render(component, container));
	flush();
	return container;
}

function submit(container: ParentNode): void {
	container.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
	flush();
}

describe('email policy forms', () => {
	it('submits only editable general settings and parses notification lines', () => {
		const onSubmit = vi.fn();
		const container = mount(() => createComponent(EmailGeneralSettingsForm, {
			initial: {
				siteName: 'YAH mail', logoUrl: '', faviconUrl: '',
				fromEmail: 'YAH <hello@example.test>', notifyEmails: ['operator@example.test'], sendOptInConfirmation: true,
				showOptInPage: true, publicArchiveEnabled: false, publicArchiveRssContentEnabled: true,
				publicSubscriptionEnabled: true, rootUrl: 'https://mail.example.test', bounceProcessingEnabled: true,
				language: 'en',
			},
			canEdit: true, pending: false, error: '', onSubmit,
		}));
		const notifications = container.querySelector<HTMLTextAreaElement>('textarea')!;
		notifications.value = 'one@example.test\ntwo@example.test, three@example.test';
		notifications.dispatchEvent(new Event('input', { bubbles: true }));
		flush();
		submit(container);
		expect(onSubmit).toHaveBeenCalledWith({
			siteName: 'YAH mail',
			logoUrl: '',
			faviconUrl: '',
			fromEmail: 'YAH <hello@example.test>',
			notifyEmails: ['one@example.test', 'two@example.test', 'three@example.test'],
			sendOptInConfirmation: true,
			showOptInPage: true,
			publicArchiveEnabled: false,
			publicArchiveRssContentEnabled: true,
		});
	});

	it('retains individual-tracking preference while global tracking is disabled', () => {
		const onSubmit = vi.fn();
		const container = mount(() => createComponent(EmailPrivacyForm, {
			initial: {
				disableTracking: false, individualTracking: true, unsubscribeHeader: true, recordOptInIp: false,
				allowBlocklist: true, allowPreferences: true, allowExport: true, allowWipe: true,
				exportable: ['profile', 'subscriptions', 'campaign_views', 'link_clicks'],
				domainBlocklist: ['blocked.example'], domainAllowlist: [],
			},
			canEdit: true, pending: false, error: '', onSubmit,
		}));
		const disable = [...container.querySelectorAll('label')].find((label) => label.textContent?.includes('Disable all message tracking'))!.querySelector('input')!;
		const individual = [...container.querySelectorAll('label')].find((label) => label.textContent?.includes('Associate tracking'))!.querySelector('input')!;
		disable.click();
		flush();
		expect(individual.disabled).toBe(true);
		expect(individual.checked).toBe(true);
		const linkClicks = [...container.querySelectorAll('label')].find((label) => label.textContent?.includes('Link clicks'))!.querySelector('input')!;
		linkClicks.click();
		flush();
		submit(container);
		expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
			disableTracking: true,
			individualTracking: true,
			exportable: ['profile', 'subscriptions', 'campaign_views'],
		}));
	});

	it('submits typed performance values and retains disabled expert preferences', () => {
		const onSubmit = vi.fn();
		const container = mount(() => createComponent(EmailPerformanceSettingsForm, {
			initial: {
				concurrency: 2, messageRate: 10, batchSize: 1_000, maxSendErrors: 1_000,
				slidingWindow: false, slidingWindowRate: 250, slidingWindowDuration: '1h',
				cacheSlowQueries: false, cacheSlowQueriesInterval: '0 3 * * *',
			},
			canManage: true, pending: false, error: '', onSubmit,
		}));
		const maxErrors = container.querySelector<HTMLInputElement>('input[aria-label="Maximum send errors"]')
			?? [...container.querySelectorAll('label')].find((label) => label.textContent?.includes('Maximum send errors'))!.querySelector('input')!;
		maxErrors.value = '900';
		maxErrors.dispatchEvent(new Event('input', { bubbles: true }));
		flush();
		submit(container);
		expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ maxSendErrors: 900, slidingWindowRate: 250 }));
	});

	it('keeps bounce secrets opaque and enforces one enabled mailbox in the draft', () => {
		const onSubmit = vi.fn(async () => true);
		const mailbox = (uuid: string, enabled: boolean) => ({
			uuid, enabled, type: 'pop' as const, host: 'pop.example.test', port: 995,
			authProtocol: 'userpass' as const, username: 'bounce', hasPassword: true,
			tlsEnabled: true, tlsSkipVerify: false, scanInterval: '15m',
		});
		const container = mount(() => createComponent(EmailBounceSettingsForm, {
			initial: {
				enabled: true,
				actions: {
					soft: { count: 3, action: 'none' }, hard: { count: 1, action: 'blocklist' }, complaint: { count: 1, action: 'unsubscribe' },
				},
				webhooksEnabled: true, sesEnabled: false,
				azure: { enabled: false, hasSharedSecret: true, sharedSecretHeader: 'x-secret' },
				sendgrid: { enabled: false, hasKey: true }, postmark: { enabled: false, username: '', hasPassword: true },
				forwardEmail: { enabled: false, hasKey: true }, lettermint: { enabled: false, hasKey: true },
				mailboxes: [mailbox('mailbox-one', false), mailbox('mailbox-two', true)],
			},
			canManage: true, canDeleteSubscribers: true, pending: false, error: '', onSubmit,
		}));
		expect(container.textContent).not.toContain('••');
		const mailboxToggles = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
			.filter((input) => input.parentElement?.textContent?.includes('Enable this mailbox'));
		expect(mailboxToggles.map(({ checked }) => checked)).toEqual([false, true]);
		mailboxToggles[0]!.click();
		flush();
		expect(mailboxToggles.map(({ checked }) => checked)).toEqual([true, false]);
		submit(container);
		expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
			azure: expect.objectContaining({ sharedSecret: null }),
			mailboxes: [
				expect.objectContaining({ uuid: 'mailbox-one', enabled: true, password: null }),
				expect.objectContaining({ uuid: 'mailbox-two', enabled: false, password: null }),
			],
		}));
	});

	it('clears bounce replacement secrets only after a successful save', async () => {
		const outcomes = [false, true];
		const onSubmit = vi.fn(async () => outcomes.shift() ?? false);
		const container = mount(() => createComponent(EmailBounceSettingsForm, {
			initial: {
				enabled: true,
				actions: {
					soft: { count: 3, action: 'none' }, hard: { count: 1, action: 'blocklist' }, complaint: { count: 1, action: 'unsubscribe' },
				},
				webhooksEnabled: true, sesEnabled: false,
				azure: { enabled: true, hasSharedSecret: false, sharedSecretHeader: 'x-secret' },
				sendgrid: { enabled: true, hasKey: false }, postmark: { enabled: true, username: 'postmark', hasPassword: false },
				forwardEmail: { enabled: true, hasKey: false }, lettermint: { enabled: true, hasKey: false },
				mailboxes: [{
					uuid: 'mailbox-one', enabled: true, type: 'pop', host: 'pop.example.test', port: 995,
					authProtocol: 'userpass', username: 'bounce', hasPassword: false,
					tlsEnabled: true, tlsSkipVerify: false, scanInterval: '15m',
				}],
			},
			canManage: true, canDeleteSubscribers: true, pending: false, error: '', onSubmit,
		}));
		const secrets = [...container.querySelectorAll<HTMLInputElement>('input[type="password"]')];
		expect(secrets).toHaveLength(6);
		for (const [index, input] of secrets.entries()) {
			input.value = `replacement-${index}`;
			input.dispatchEvent(new Event('input', { bubbles: true }));
		}
		flush();
		submit(container);
		await Promise.resolve();
		flush();
		expect(secrets.map(({ value }) => value)).toEqual(secrets.map((_, index) => `replacement-${index}`));

		submit(container);
		await Promise.resolve();
		flush();
		expect(secrets.map(({ value }) => value)).toEqual(secrets.map(() => ''));
		expect(secrets.every((input) => input.placeholder === 'Saved credential')).toBe(true);
	});
});
