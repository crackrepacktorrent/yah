import { createComponent, render } from '@solidjs/web';
import { flush } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SmtpServer } from './contracts';
import { EmailSettingsForm } from './form';

const disposers: Array<() => void> = [];
afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
});

const initial: SmtpServer = {
	uuid: '10000000-0000-4000-8000-000000000001',
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
	fromAddresses: [],
};

function inputFor(container: ParentNode, label: string): HTMLInputElement {
	const field = [...container.querySelectorAll('label')].find((candidate) => candidate.querySelector('span')?.textContent === label);
	const input = field?.querySelector('input');
	if (!(input instanceof HTMLInputElement)) throw new Error(`Missing ${label} input.`);
	return input;
}

describe('EmailSettingsForm', () => {
	it('preserves focus while editing, updates rows, and clears a saved password', async () => {
		const onSubmit = vi.fn().mockResolvedValue(true);
		const container = document.createElement('div');
		document.body.append(container);
		disposers.push(() => container.remove());
		disposers.push(render(() => createComponent(EmailSettingsForm, {
			initial: [initial],
			canEdit: true,
			pending: false,
			testingUuid: '',
			error: '',
			onSubmit,
			onTest: vi.fn(),
		}), container));
		flush();

		const host = inputFor(container, 'Host');
		host.focus();
		for (const character of '-updated') {
			host.value += character;
			host.dispatchEvent(new InputEvent('input', { bubbles: true, data: character }));
			flush();
			expect(document.activeElement).toBe(host);
		}
		expect(inputFor(container, 'Host').value).toBe('smtp.example.test-updated');
		const password = container.querySelector<HTMLInputElement>('input[type="password"]')!;
		password.value = 'replacement-secret';
		password.dispatchEvent(new InputEvent('input', { bubbles: true }));

		const add = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Add SMTP server')!;
		add.click();
		flush();
		expect(container.querySelectorAll('.smtp-server-card')).toHaveLength(2);

		const removeButtons = [...container.querySelectorAll<HTMLButtonElement>('.smtp-server-card .button--danger-secondary')];
		removeButtons[1]?.click();
		flush();
		expect(container.querySelectorAll('.smtp-server-card')).toHaveLength(1);

		container.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
		expect(onSubmit).toHaveBeenCalledWith({ servers: [expect.objectContaining({
			uuid: initial.uuid,
			host: 'smtp.example.test-updated',
			password: 'replacement-secret',
		})] });
		await vi.waitFor(() => expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe(''));
		expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.placeholder).toBe('Saved password');
	});

	it('does not invent a saved-password marker for an empty auth-none replacement', async () => {
		const onSubmit = vi.fn().mockResolvedValue(true);
		const container = document.createElement('div');
		document.body.append(container);
		disposers.push(() => container.remove());
		disposers.push(render(() => createComponent(EmailSettingsForm, {
			initial: [{ ...initial, hasPassword: false }],
			canEdit: true,
			pending: false,
			testingUuid: '',
			error: '',
			onSubmit,
			onTest: vi.fn(),
		}), container));
		flush();

		const password = container.querySelector<HTMLInputElement>('input[type="password"]')!;
		password.value = 'temporary';
		password.dispatchEvent(new InputEvent('input', { bubbles: true }));
		password.value = '';
		password.dispatchEvent(new InputEvent('input', { bubbles: true }));
		const authentication = [...container.querySelectorAll('label')]
			.find((candidate) => candidate.querySelector('span')?.textContent === 'Authentication')
			?.querySelector('select');
		if (!(authentication instanceof HTMLSelectElement)) throw new Error('Missing Authentication select.');
		authentication.value = 'none';
		authentication.dispatchEvent(new Event('change', { bubbles: true }));
		flush();
		container.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(password.value).toBe(''));
		expect(password.placeholder).toBe('');
	});
});
