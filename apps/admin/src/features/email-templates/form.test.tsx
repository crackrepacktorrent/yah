import { createComponent, render } from '@solidjs/web';
import { flush } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmailTemplateForm } from './form';

const disposers: Array<() => void> = [];

afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
});

describe('EmailTemplateForm preview lifecycle', () => {
	it('explains why the template type is fixed while editing', () => {
		const container = document.createElement('div');
		document.body.append(container);
		disposers.push(() => container.remove());
		disposers.push(render(() => createComponent(EmailTemplateForm, {
			mode: 'edit',
			initial: { name: 'Campaign', kind: 'campaign', subject: '', body: '{{ template "content" . }}' },
			pending: false,
			error: '',
			cancelHref: '/emails',
			onSubmit: vi.fn(),
			onPreview: vi.fn(),
		}), container));

		expect(container.querySelector<HTMLSelectElement>('select[name="kind"]')?.disabled).toBe(true);
		expect(container.textContent).toContain("Listmonk 6.2 cannot change an existing template's type. Create a new template instead.");
	});

	it('ignores a preview response after its body has changed', async () => {
		const pending: Array<(html: string) => void> = [];
		const onPreview = vi.fn(
			() => new Promise<string>((resolve) => pending.push(resolve)),
		);
		const container = document.createElement('div');
		document.body.append(container);
		disposers.push(() => container.remove());
		disposers.push(
			render(
				() =>
					createComponent(EmailTemplateForm, {
						mode: 'create',
						initial: { name: 'Transactional', kind: 'tx', subject: 'Subject', body: '<p>First</p>' },
						pending: false,
						error: '',
						cancelHref: '/emails',
						onSubmit: vi.fn(),
						onPreview,
					}),
				container,
			),
		);
		flush();

		const previewButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Render preview')!;
		const body = container.querySelector<HTMLTextAreaElement>('textarea[name="body"]')!;
		previewButton.click();
		flush();
		expect(previewButton.getAttribute('aria-busy')).toBe('true');

		body.value = '<p>Second</p>';
		body.dispatchEvent(new InputEvent('input', { bubbles: true }));
		flush();
		pending[0]?.('<p>Stale</p>');
		await vi.waitFor(() => expect(previewButton.getAttribute('aria-busy')).toBeNull());
		expect(container.querySelector('iframe')).toBeNull();

		previewButton.click();
		flush();
		pending[1]?.('<p>Current</p>');
		await vi.waitFor(() => expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toBe('<p>Current</p>'));
		expect(onPreview).toHaveBeenNthCalledWith(1, { kind: 'tx', body: '<p>First</p>' });
		expect(onPreview).toHaveBeenNthCalledWith(2, { kind: 'tx', body: '<p>Second</p>' });
	});
});
