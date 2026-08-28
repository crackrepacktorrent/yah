import { createComponent, render } from '@solidjs/web';
import { createSignal, flush } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MailingList } from '~/features/mailing-lists/contracts';
import type { SubscriberDetail, SubscriberMembership } from './contracts';
import { SubscriberCreateForm, SubscriberMembershipForm, SubscriberProfileForm } from './form';

const disposers: Array<() => void> = [];
afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
});

function list(id: number, overrides: Partial<MailingList> = {}): MailingList {
	return {
		id,
		uuid: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
		name: `List ${id}`,
		kind: 'private',
		optIn: 'single',
		status: 'active',
		description: '',
		tags: [],
		subscriberCount: 0,
		unconfirmedCount: 0,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	};
}

function membership(id: number, overrides: Partial<SubscriberMembership> = {}): SubscriberMembership {
	return {
		id,
		uuid: `10000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
		name: `List ${id}`,
		kind: 'private',
		optIn: 'single',
		listStatus: 'active',
		description: null,
		restricted: false,
		status: 'confirmed',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		meta: {},
		...overrides,
	};
}

function subscriber(overrides: Partial<SubscriberDetail> = {}): SubscriberDetail {
	return {
		id: 7,
		uuid: '20000000-0000-4000-8000-000000000007',
		email: 'reader@example.com',
		name: 'Reader',
		status: 'enabled',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-02T00:00:00.000Z',
		attributes: { source: 'fixture' },
		memberships: [],
		membershipVersion: `smv1-${'a'.repeat(43)}`,
		canRequestOptIn: false,
		...overrides,
	};
}

function mount(component: Parameters<typeof render>[0]): HTMLDivElement {
	const container = document.createElement('div');
	document.body.append(container);
	disposers.push(() => container.remove());
	disposers.push(render(component, container));
	flush();
	return container;
}

describe('SubscriberCreateForm', () => {
	it('offers only active non-temporary lists and makes preconfirmation explicit', () => {
		const onSubmit = vi.fn();
		const container = mount(() => createComponent(SubscriberCreateForm, {
			lists: [list(1), list(2, { optIn: 'double' }), list(3, { status: 'archived' }), list(4, { kind: 'temporary' })],
			pending: false,
			error: '',
			cancelHref: '/emails/subscribers',
			onSubmit,
		}));

		expect([...container.querySelectorAll<HTMLInputElement>('input[name="listId"]')].map((input) => input.value)).toEqual(['1', '2']);
		const email = container.querySelector<HTMLInputElement>('input[name="email"]')!;
		email.value = 'New.Reader@Example.com';
		email.dispatchEvent(new InputEvent('input', { bubbles: true }));
		container.querySelector<HTMLInputElement>('input[value="2"]')!.click();
		flush();
		const preconfirm = container.querySelector<HTMLInputElement>('input[name="preconfirmSubscriptions"]')!;
		expect(preconfirm.disabled).toBe(false);
		preconfirm.click();
		flush();
		container.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		flush();

		expect(onSubmit).toHaveBeenCalledWith({ email: 'New.Reader@Example.com', name: '', status: 'enabled', listIds: [2], preconfirmSubscriptions: true });
		expect(container.textContent).toContain('single opt-in memberships are confirmed and double opt-in memberships remain unconfirmed');
	});

	it('prevents a disabled identity from stranding an unconfirmed double-opt-in membership', () => {
		const container = mount(() => createComponent(SubscriberCreateForm, {
			lists: [list(2, { optIn: 'double' })],
			pending: false,
			error: '',
			cancelHref: '/emails/subscribers',
			onSubmit: vi.fn(),
		}));
		container.querySelector<HTMLInputElement>('input[value="2"]')!.click();
		const status = container.querySelector<HTMLSelectElement>('select[name="status"]')!;
		status.value = 'disabled';
		status.dispatchEvent(new Event('change', { bubbles: true }));
		flush();
		expect(container.querySelector('[role="alert"]')?.textContent).toContain('cannot complete double opt-in');
		expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);

		container.querySelector<HTMLInputElement>('input[name="preconfirmSubscriptions"]')!.click();
		flush();
		expect(container.querySelector('[role="alert"]')).toBeNull();
		expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
	});
});

describe('SubscriberProfileForm', () => {
	it('keeps blocklisted status read-only instead of hiding recovery inside ordinary editing', () => {
		const container = mount(() => createComponent(SubscriberProfileForm, {
			subscriber: subscriber({ status: 'blocklisted' }),
			resetVersion: 0,
			pending: false,
			error: '',
			onSubmit: vi.fn(),
		}));

		expect(container.querySelector('select[name="status"]')).toBeNull();
		expect(container.querySelector<HTMLInputElement>('input[value="Blocklisted"]')?.disabled).toBe(true);
		expect(container.textContent).toContain('separate recovery workflow');
	});

	it('preserves a dirty draft across unrelated data refreshes and resets after its own save', () => {
		const [current, setCurrent] = createSignal(subscriber());
		const [resetVersion, setResetVersion] = createSignal(0);
		const container = mount(() => createComponent(SubscriberProfileForm, {
			get subscriber() { return current(); },
			get resetVersion() { return resetVersion(); },
			pending: false,
			error: '',
			onSubmit: vi.fn(),
		}));
		const name = container.querySelector<HTMLInputElement>('input[name="name"]')!;
		name.value = 'Unsaved profile draft';
		name.dispatchEvent(new InputEvent('input', { bubbles: true }));
		setCurrent(subscriber({ name: 'Provider profile', updatedAt: '2026-01-03T00:00:00.000Z' }));
		flush();
		expect(name.value).toBe('Unsaved profile draft');

		setResetVersion(1);
		flush();
		expect(name.value).toBe('Provider profile');
	});
});

describe('SubscriberMembershipForm', () => {
	it('submits only authorable choices while rendering protected memberships read-only', () => {
		const onSubmit = vi.fn();
		const detail = subscriber({
			memberships: [
				membership(1),
				membership(3, { listStatus: 'archived' }),
				membership(4, { kind: 'temporary' }),
				membership(5, { status: 'unsubscribed' }),
			],
		});
		const container = mount(() => createComponent(SubscriberMembershipForm, {
			subscriber: detail,
			lists: [list(1), list(2, { optIn: 'double' }), list(3, { status: 'archived' }), list(4, { kind: 'temporary' }), list(5)],
			resetVersion: 0,
			pending: false,
			error: '',
			onSubmit,
		}));

		expect([...container.querySelectorAll<HTMLInputElement>('fieldset input[name="listId"]')].map((input) => input.value)).toEqual(['1', '2']);
		expect(container.textContent).toContain('Provider- or consent-protected memberships');
		container.querySelector<HTMLInputElement>('input[value="1"]')!.click();
		container.querySelector<HTMLInputElement>('input[value="2"]')!.click();
		flush();
		container.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		flush();

		expect(onSubmit).toHaveBeenCalledWith([2]);
		expect(container.textContent).toContain('Unchecking an existing membership unsubscribes it while preserving its consent history');
		expect(container.textContent).toContain('remain unconfirmed until the recipient confirms');
	});

	it('preserves dirty membership choices across a profile refresh', () => {
		const [current, setCurrent] = createSignal(subscriber({ memberships: [membership(1)] }));
		const [resetVersion, setResetVersion] = createSignal(0);
		const container = mount(() => createComponent(SubscriberMembershipForm, {
			get subscriber() { return current(); },
			lists: [list(1), list(2)],
			get resetVersion() { return resetVersion(); },
			pending: false,
			error: '',
			onSubmit: vi.fn(),
		}));
		const second = container.querySelector<HTMLInputElement>('input[value="2"]')!;
		second.click();
		setCurrent(subscriber({ memberships: [membership(1)], updatedAt: '2026-01-03T00:00:00.000Z' }));
		flush();
		expect(second.checked).toBe(true);

		setResetVersion(1);
		flush();
		expect(second.checked).toBe(false);
	});
});
