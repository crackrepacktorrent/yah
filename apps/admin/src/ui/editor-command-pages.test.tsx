import { createComponent, render } from '@solidjs/web';
import { flush } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CampaignDetailPage from '~/routes/(app)/emails/campaigns/[id]';
import MailingListDetailPage from '~/routes/(app)/emails/lists/[id]';
import SubscriberDetailPage from '~/routes/(app)/emails/subscribers/[id]';

const state = vi.hoisted(() => {
	const updatedAt = '2026-08-26T12:00:00Z';
	return {
		campaign: { id: 21, name: 'Draft', subject: 'Subject', status: 'draft', type: 'regular', contentType: 'html', body: '<p>Draft</p>', fromEmail: '', lists: [], tags: [], templateId: null, sendAt: null, updatedAt },
		list: { id: 11, name: 'Supporters', kind: 'private', optIn: 'single', status: 'active', description: '', updatedAt },
		subscriber: { id: 7, name: 'Person', email: 'person@example.test', status: 'enabled', updatedAt },
		updateCampaign: vi.fn(), updateList: vi.fn(), updateProfile: vi.fn(), updateMemberships: vi.fn(), requestOptIn: vi.fn(),
		listCampaigns: vi.fn(), getActivity: vi.fn(), listBounces: vi.fn(),
		refreshFails: false,
		success: vi.fn(),
	};
});

vi.mock('@solidjs/router', () => ({ revalidate: vi.fn(), useNavigate: () => vi.fn() }));
vi.mock('@solidjs/router/fs', () => ({ defineFileRoute: vi.fn() }));
vi.mock('@yah/admin-core/permissions', () => ({ can: () => true }));
vi.mock('~/platform/auth/session', () => ({ requireSession: () => ({}) }));
vi.mock('~/ui/toast', () => ({ toast: { success: state.success, error: vi.fn() } }));
vi.mock('~/features/campaigns/server', () => ({
	getCampaign: Object.assign(() => state.campaign, { keyFor: (id: number) => `campaign[${id}]` }),
	listCampaigns: Object.assign(state.listCampaigns, { key: 'campaigns' }),
	updateCampaign: state.updateCampaign,
	deleteCampaigns: vi.fn(), transitionCampaign: vi.fn(),
	previewCampaign: Object.assign(vi.fn(), { keyFor: (id: number) => `preview[${id}]` }),
}));
vi.mock('~/features/email-templates/server', () => ({ listEmailTemplates: () => [] }));
vi.mock('~/features/mailing-lists/server', () => ({
	getMailingList: Object.assign(() => state.refreshFails ? Promise.reject(new Error('private provider diagnostic')) : state.list, { keyFor: (id: number) => `list[${id}]` }),
	listMailingLists: Object.assign(() => [], { key: 'lists' }),
	updateMailingList: state.updateList, deleteMailingList: vi.fn(),
}));
vi.mock('~/features/subscribers/server', () => ({
	getSubscriber: Object.assign(() => state.subscriber, { keyFor: (id: number) => `subscriber[${id}]` }),
	getSubscriberMemberships: Object.assign(() => ({ memberships: [], membershipVersion: 'version', canRequestOptIn: true }), { keyFor: (id: number) => `memberships[${id}]` }),
	listSubscribers: { key: 'subscribers' }, getSubscriberActivity: Object.assign(state.getActivity, { keyFor: (id: number) => `activity[${id}]` }),
	updateSubscriberProfile: state.updateProfile, updateSubscriberMemberships: state.updateMemberships,
	requestSubscriberOptIn: state.requestOptIn, deleteSubscribers: vi.fn(), blocklistSubscribers: vi.fn(),
}));
vi.mock('~/features/bounces/server', () => ({ clearSubscriberBounces: vi.fn(), listSubscriberBounces: Object.assign(state.listBounces, { keyFor: (id: number) => `bounces[${id}]` }) }));
vi.mock('~/features/campaign-test-sends/server', () => ({ sendCampaignTest: vi.fn() }));

const disposers: Array<() => void> = [];

function mount(kind: 'campaign' | 'list' | 'subscriber') {
	const container = document.createElement('div');
	document.body.append(container);
	const routeProps = { location: { pathname: '/', search: '', hash: '', query: {}, state: null, key: '' }, data: undefined };
	const dispose = render(() => {
		if (kind === 'campaign') return createComponent(CampaignDetailPage, { ...routeProps, params: { id: '21' } });
		if (kind === 'list') return createComponent(MailingListDetailPage, { ...routeProps, params: { id: '11' } });
		return createComponent(SubscriberDetailPage, { ...routeProps, params: { id: '7' } });
	}, container);
	disposers.push(() => { dispose(); container.remove(); });
	flush();
	return container;
}

beforeEach(() => {
	state.refreshFails = false;
	state.listCampaigns.mockReturnValue([]);
	state.getActivity.mockReturnValue({ campaignViews: [], linkClicks: [] });
	state.listBounces.mockReturnValue([]);
	// jsdom does not implement the native dialog methods.
	Object.defineProperties(HTMLDialogElement.prototype, {
		showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } },
		close: { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } },
	});
});

afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
	vi.restoreAllMocks();
	vi.resetAllMocks();
	Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
	Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('editor command boundaries', () => {
	it('loads subscriber activity, bounce history, and test campaigns only when their panels open', () => {
		const container = mount('subscriber');
		for (const query of [state.listCampaigns, state.getActivity, state.listBounces]) expect(query).not.toHaveBeenCalled();
		for (const [label, query, content] of [
			['Load activity', state.getActivity, 'No campaign views.'],
			['Load bounce history', state.listBounces, 'No bounce records for this subscriber.'],
			['Choose campaign', state.listCampaigns, 'No ordinary draft email campaigns are available.'],
		] as const) {
			[...container.querySelectorAll('button')].find((button) => button.textContent === label)!.click();
			flush();
			expect(query).toHaveBeenCalledTimes(1);
			expect(container.textContent).toContain(content);
		}
	});

	it.each([
		['campaign', '.campaign-form', state.updateCampaign],
		['list', '.mailing-list-form', state.updateList],
		['subscriber', '.subscriber-form', state.updateProfile],
		['subscriber', '.subscriber-membership-form', state.updateMemberships],
	] as const)('serializes %s saves through %s before Solid commits disabled controls', async (kind, selector, save) => {
		let resolve!: () => void;
		save.mockImplementation(() => new Promise<void>((accept) => { resolve = accept; }));
		const container = mount(kind);
		const form = container.querySelector<HTMLFormElement>(selector)!;
		for (let i = 0; i < 2; i++) form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		expect(save).toHaveBeenCalledTimes(1);
		flush();
		expect(form.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(true);
		resolve();
		await vi.waitFor(() => expect(form.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(false));
		expect(state.success).toHaveBeenCalledTimes(1);
	});

	it('serializes subscriber confirmation requests even before the dialog commits its pending state', async () => {
		let resolve!: () => void;
		state.requestOptIn.mockImplementation(() => new Promise<void>((accept) => { resolve = accept; }));
		const container = mount('subscriber');
		[...container.querySelectorAll('button')].find((button) => button.textContent === 'Request confirmation')!.click();
		flush();
		const confirm = container.querySelector<HTMLButtonElement>('dialog[open] button[type="button"]:last-child')!;
		confirm.click();
		confirm.click();
		expect(state.requestOptIn).toHaveBeenCalledTimes(1);
		resolve();
		await vi.waitFor(() => expect(state.success).toHaveBeenCalledWith('Opt-in request accepted.'));
	});

	it('reports a saved list with failed refresh distinctly and keeps provider details private', async () => {
		state.updateList.mockResolvedValue(undefined);
		const container = mount('list');
		state.refreshFails = true;
		container.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('The mailing list was saved'));
		expect(container.textContent).not.toContain('private provider diagnostic');
		expect(state.success).not.toHaveBeenCalled();
		expect(state.updateList).toHaveBeenCalledTimes(1);
	});
});
