import { createComponent, render } from '@solidjs/web';
import { flush } from 'solid-js';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Toaster, UserFacingError, toast, toastError } from './toast';

const disposers: Array<() => void> = [];

function mountToaster(): HTMLDivElement {
	const container = document.createElement('div');
	document.body.append(container);
	disposers.push(() => container.remove());
	disposers.push(render(() => createComponent(Toaster, {}), container));
	flush();
	return container;
}

afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
	vi.useRealTimers();
});

describe('toast facade', () => {
	test('replays pre-mount notifications and hides unknown error details', () => {
		toast.success('Queued before mount');
		toastError(new Error('database password leaked'), 'The request failed safely.');
		toastError(new UserFacingError('This message is approved.'), 'Unused fallback');

		const container = mountToaster();

		expect(container.querySelector('[role="status"]')?.textContent).toContain('Queued before mount');
		const alerts = [...container.querySelectorAll('[role="alert"]')].map((element) => element.textContent);
		expect(alerts).toHaveLength(2);
		expect(alerts.join(' ')).toContain('The request failed safely.');
		expect(alerts.join(' ')).toContain('This message is approved.');
		expect(alerts.join(' ')).not.toContain('database password leaked');
	});

	test('dismisses success after its timeout while errors remain persistent', () => {
		vi.useFakeTimers();
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		const container = mountToaster();

		toast.success('Temporary');
		toast.error('Persistent');
		flush();
		vi.advanceTimersByTime(8_000);
		flush();

		expect(container.querySelector('[role="status"]')).toBeNull();
		expect(container.querySelector('[role="alert"]')?.textContent).toContain('Persistent');
	});

	test('pauses a success timeout during pointer interaction', () => {
		vi.useFakeTimers();
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		const container = mountToaster();

		toast.success('Read me');
		flush();
		const item = container.querySelector<HTMLElement>('[role="status"]');
		expect(item).not.toBeNull();
		item?.dispatchEvent(new Event('pointerenter'));
		vi.advanceTimersByTime(20_000);
		flush();
		expect(container.querySelector('[role="status"]')).not.toBeNull();

		item?.dispatchEvent(new Event('pointerleave'));
		vi.advanceTimersByTime(8_000);
		flush();
		expect(container.querySelector('[role="status"]')).toBeNull();
	});

	test('pauses success timeouts while focused and while the document is hidden', () => {
		vi.useFakeTimers();
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		const returnTarget = document.createElement('button');
		document.body.append(returnTarget);
		disposers.push(() => returnTarget.remove());
		returnTarget.focus();
		const container = mountToaster();

		toast.success('Focus pause');
		flush();
		const dismiss = container.querySelector<HTMLButtonElement>('[aria-label="Dismiss success notification: Focus pause"]');
		dismiss?.focus();
		vi.advanceTimersByTime(20_000);
		flush();
		expect(container.querySelector('[role="status"]')).not.toBeNull();

		returnTarget.focus();
		Object.defineProperty(document, 'hidden', { configurable: true, value: true });
		document.dispatchEvent(new Event('visibilitychange'));
		vi.advanceTimersByTime(20_000);
		flush();
		expect(container.querySelector('[role="status"]')).not.toBeNull();

		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
		document.dispatchEvent(new Event('visibilitychange'));
		vi.advanceTimersByTime(8_000);
		flush();
		expect(container.querySelector('[role="status"]')).toBeNull();
	});

	test('caps notifications without evicting the focused item', () => {
		const container = mountToaster();
		for (let index = 1; index <= 4; index++) toast.error(`Error ${index}`);
		flush();

		const firstDismiss = container.querySelector<HTMLButtonElement>('[aria-label="Dismiss error notification: Error 1"]');
		firstDismiss?.focus();
		toast.success('Newest feedback');
		flush();

		const messages = [...container.querySelectorAll('[role="alert"] p')].map((element) => element.textContent);
		expect(messages).toHaveLength(3);
		expect(container.querySelectorAll('[role="alert"], [role="status"]')).toHaveLength(4);
		expect(messages).toContain('Error 1');
		expect(messages).not.toContain('Error 2');
		expect(container.querySelector('[role="status"]')?.textContent).toContain('Newest feedback');
	});

	test('dismisses a notification and returns focus to the control that triggered it', async () => {
		const trigger = document.createElement('button');
		document.body.append(trigger);
		disposers.push(() => trigger.remove());
		trigger.focus();

		const container = mountToaster();
		toast.success('Settings saved.');
		flush();

		// The region is a passive landmark: each notification announces itself
		// through its own status/alert role, so the region must not also be live.
		const region = container.querySelector('[role="region"]');
		expect(region?.getAttribute('aria-label')).toBe('Notifications');
		expect(region?.hasAttribute('aria-live')).toBe(false);

		const dismiss = container.querySelector<HTMLButtonElement>(
			'[aria-label="Dismiss success notification: Settings saved."]',
		);
		expect(dismiss).not.toBeNull();
		dismiss?.focus();
		dismiss?.click();
		flush();

		expect(container.querySelectorAll('[role="status"]')).toHaveLength(0);
		await new Promise<void>((resolve) => queueMicrotask(resolve));
		expect(document.activeElement).toBe(trigger);
	});

	test('keeps errors dismissible and does not steal focus from an unrelated control', async () => {
		const container = mountToaster();
		const elsewhere = document.createElement('button');
		document.body.append(elsewhere);
		disposers.push(() => elsewhere.remove());

		toast.error('Settings could not be saved.');
		flush();
		elsewhere.focus();

		const dismiss = container.querySelector<HTMLButtonElement>(
			'[aria-label="Dismiss error notification: Settings could not be saved."]',
		);
		dismiss?.click();
		flush();

		expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0);
		await new Promise<void>((resolve) => queueMicrotask(resolve));
		expect(document.activeElement).toBe(elsewhere);
	});
});
