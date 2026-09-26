import { createComponent, render } from '@solidjs/web';
import { flush } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { revalidate } from '@solidjs/router';
import SubscriptionSharingPage from '~/routes/(app)/emails/forms/index';
import { setMailingListVisibility } from './server';

vi.mock('@solidjs/router', () => ({ revalidate: vi.fn() }));
vi.mock('@solidjs/router/fs', () => ({ defineFileRoute: vi.fn() }));
vi.mock('@yah/admin-core/permissions', () => ({ can: () => true }));
vi.mock('~/platform/auth/session', () => ({ requireSession: () => ({}) }));
vi.mock('~/ui/toast', () => ({ toast: { success: vi.fn() } }));
vi.mock('./server', () => ({
	listMailingLists: Object.assign(() => [1, 2].map((id) => ({
		id, uuid: `list-${id}`, name: `List ${id}`, kind: 'public', status: 'active',
		optIn: 'double', subscriberCount: 10, updatedAt: '2026-09-26T12:00:00Z',
	})), { key: 'mailing-lists' }),
	getMailingList: { keyFor: (id: number) => `mailing-list[${id}]` },
	getSubscriptionSharingConfig: () => ({ publicSiteUrl: 'https://example.org' }),
	setMailingListVisibility: vi.fn(),
}));

const disposers: Array<() => void> = [];

function mountPage() {
	const container = document.createElement('div');
	document.body.append(container);
	disposers.push(() => container.remove());
	const dispose = render(() => createComponent(SubscriptionSharingPage, {}), container);
	disposers.push(dispose);
	flush();
	return { container, dispose };
}

afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('subscription sharing interactions', () => {
	it('serializes visibility changes and refreshes both list summaries and details', async () => {
		let resolve!: () => void;
		vi.mocked(setMailingListVisibility).mockImplementation(() => new Promise<void>((accept) => { resolve = accept; }));
		const { container } = mountPage();
		const buttons = [...container.querySelectorAll('button')].filter((button) => button.textContent === 'Make private');
		buttons[0]!.click();
		// Even before Solid commits the disabled state, only one command starts.
		buttons[1]!.click();
		flush();
		expect(setMailingListVisibility).toHaveBeenCalledExactlyOnceWith({ id: 1, expectedUpdatedAt: '2026-09-26T12:00:00Z', public: false });
		expect(buttons.every((button) => button.disabled)).toBe(true);
		resolve();
		await vi.waitFor(() => expect(buttons.every((button) => !button.disabled)).toBe(true));
		expect(revalidate).toHaveBeenCalledExactlyOnceWith(['mailing-lists', 'mailing-list[1]']);
	});

	it('restarts the copied indicator timeout when the same snippet is copied again', async () => {
		vi.useFakeTimers();
		const writeText = vi.fn(async () => {});
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		const { container, dispose } = mountPage();
		const copy = container.querySelector<HTMLButtonElement>('.subscription-embed-header button')!;
		copy.click();
		await vi.advanceTimersByTimeAsync(0);
		flush();
		expect(copy.textContent).toBe('Copied');
		await vi.advanceTimersByTimeAsync(1_500);
		copy.click();
		await vi.advanceTimersByTimeAsync(0);
		flush();
		await vi.advanceTimersByTimeAsync(500);
		flush();
		expect(copy.textContent).toBe('Copied');
		await vi.advanceTimersByTimeAsync(1_500);
		flush();
		expect(copy.textContent).toBe('Copy');
		expect(writeText).toHaveBeenCalledTimes(2);

		copy.click();
		await vi.advanceTimersByTimeAsync(0);
		dispose();
		expect(vi.getTimerCount()).toBe(0);
	});
});
