import { createComponent, render } from '@solidjs/web';
import { flush } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CampaignForm, toLocalCampaignDateTime } from './form';

const disposers: Array<() => void> = [];
afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
});

describe('CampaignForm', () => {
	it('round-trips an ISO timestamp through the local datetime control', () => {
		const iso = '2099-01-02T03:04:00.000Z';
		const local = toLocalCampaignDateTime(iso);
		expect(new Date(local).toISOString()).toBe(iso);
	});

	it('limits confirmation campaigns to active double opt-in lists and submits provider-owned content empty', () => {
		const onSubmit = vi.fn();
		const container = document.createElement('div');
		document.body.append(container);
		disposers.push(() => container.remove());
		disposers.push(render(() => createComponent(CampaignForm, {
			mode: 'create',
			lists: [
				{ id: 11, uuid: 'a6262d3f-4a14-4f7a-8f75-6b73306595d8', name: 'Double', kind: 'private', optIn: 'double', status: 'active', description: '', tags: [], subscriberCount: 1, unconfirmedCount: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
				{ id: 12, uuid: '88054b11-a1f0-488f-aaf5-d9b38b193be4', name: 'Single', kind: 'private', optIn: 'single', status: 'active', description: '', tags: [], subscriberCount: 1, unconfirmedCount: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
			],
			templates: [],
			pending: false,
			error: '',
			cancelHref: '/emails/campaigns',
			onSubmit,
		}), container));
		flush();

		const optin = container.querySelector<HTMLInputElement>('input[value="optin"]')!;
		optin.click();
		flush();
		expect(container.textContent).toContain('Double');
		expect(container.textContent).not.toContain('Single opt-in · private');
		const double = container.querySelector<HTMLInputElement>('input[value="11"]')!;
		double.click();
		flush();
		for (const [name, value] of [['name', 'Confirmation'], ['subject', 'Please confirm']] as const) {
			const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
			input.value = value;
			input.dispatchEvent(new InputEvent('input', { bubbles: true }));
			flush();
		}
		container.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		flush();
		expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'optin', listIds: [11], body: '', contentType: 'richtext' }));
	});

	it('shows a selected archived target as removal-only so it cannot lock every edit', () => {
		const onSubmit = vi.fn();
		const container = document.createElement('div');
		document.body.append(container);
		disposers.push(() => container.remove());
		disposers.push(render(() => createComponent(CampaignForm, {
			mode: 'edit',
			initial: {
				type: 'regular',
				name: 'Archived target draft',
				subject: 'Review the audience',
				fromEmail: '',
				listIds: [13],
				body: '<p>Draft</p>',
				contentType: 'html',
				templateId: null,
				tags: [],
				sendAt: null,
			},
			lists: [
				{ id: 11, uuid: 'a6262d3f-4a14-4f7a-8f75-6b73306595d8', name: 'Active', kind: 'private', optIn: 'double', status: 'active', description: '', tags: [], subscriberCount: 1, unconfirmedCount: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
				{ id: 13, uuid: '3f27fbfd-fb62-43e0-985c-b86c77a6e192', name: 'Archived', kind: 'private', optIn: 'double', status: 'archived', description: '', tags: [], subscriberCount: 1, unconfirmedCount: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
			],
			templates: [],
			pending: false,
			error: '',
			cancelHref: '/emails/campaigns',
			onSubmit,
		}), container));
		flush();

		const archived = container.querySelector<HTMLInputElement>('input[value="13"]')!;
		expect(archived.checked).toBe(true);
		expect(archived.disabled).toBe(false);
		expect(container.textContent).toContain('Archived · Remove before saving');
		archived.click();
		container.querySelector<HTMLInputElement>('input[value="11"]')!.click();
		flush();
		expect(container.querySelector('input[value="13"]')).toBeNull();

		container.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
		flush();
		expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ listIds: [11] }));
	});

	it('offers only ordinary campaign templates while preserving a legacy visual selection', () => {
		const container = document.createElement('div');
		document.body.append(container);
		disposers.push(() => container.remove());
		disposers.push(render(() => createComponent(CampaignForm, {
			mode: 'edit',
			initial: {
				type: 'regular',
				name: 'Legacy visual draft',
				subject: 'Review',
				fromEmail: '',
				listIds: [11],
				body: '<p>Draft</p>',
				contentType: 'html',
				templateId: 4,
				tags: [],
				sendAt: null,
			},
			lists: [
				{ id: 11, uuid: 'a6262d3f-4a14-4f7a-8f75-6b73306595d8', name: 'Active', kind: 'private', optIn: 'double', status: 'active', description: '', tags: [], subscriberCount: 1, unconfirmedCount: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
			],
			templates: [
				{ id: 1, name: 'Ordinary campaign', kind: 'campaign', subject: '', isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
				{ id: 4, name: 'Visual newsletter', kind: 'campaign_visual', subject: '', isDefault: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
			],
			pending: false,
			error: '',
			cancelHref: '/emails/campaigns',
			onSubmit: vi.fn(),
		}), container));
		flush();

		const options = [...container.querySelectorAll<HTMLOptionElement>('select[name="templateId"] option')];
		expect(options.map((option) => option.textContent)).toEqual([
			'Default campaign template',
			'Current template #4',
			'Ordinary campaign',
		]);
		expect(options.find((option) => option.selected)?.value).toBe('4');
		expect(container.textContent).not.toContain('Visual newsletter');
	});
});
