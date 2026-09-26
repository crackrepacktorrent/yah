import { createComponent, render } from '@solidjs/web';
import { flush } from 'solid-js';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { RichTextEditor } from './rich-text-editor';

const disposers: Array<() => void> = [];

afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
});

describe('RichTextEditor', () => {
	test('normalizes imported HTML through the registered Lexical nodes', async () => {
		const container = document.createElement('div');
		document.body.append(container);
		const onChange = vi.fn();
		const dispose = render(
			() =>
				createComponent(RichTextEditor, {
					label: 'Campaign content',
					onChange,
					value: '<p onclick="alert(1)">Safe<script>alert(2)</script><a href="javascript:alert(3)" style="color:red"> link</a></p>',
				}),
			container,
		);

		await vi.waitFor(() => expect(container.querySelector('[role="textbox"]')?.textContent?.replaceAll(/\s/g, '')).toBe('Safelink'));
		const editor = container.querySelector('[role="textbox"]');
		expect(editor?.querySelector('script')).toBeNull();
		expect(editor?.querySelector('[onclick]')).toBeNull();
		expect(editor?.querySelector('[style]')).toBeNull();
		expect(editor?.querySelector('a')?.getAttribute('href')).toBe('about:blank');
		expect(onChange).not.toHaveBeenCalled();

		dispose();
		container.remove();
	});

	test.each(['click', 'Enter'] as const)('applies a link with %s without submitting or invalidating its parent form', async (action) => {
		const form = document.createElement('form');
		const container = document.createElement('div');
		const submit = document.createElement('button');
		submit.type = 'submit';
		form.append(container, submit);
		document.body.append(form);
		disposers.push(() => form.remove());
		const onSubmit = vi.fn((event: Event) => event.preventDefault());
		form.addEventListener('submit', onSubmit);
		disposers.push(render(() => createComponent(RichTextEditor, {
			label: 'Campaign content',
			value: '<p>Campaign body</p>',
		}), container));
		const addLink = container.querySelector<HTMLButtonElement>('[aria-label="Add link"]')!;
		await vi.waitFor(() => expect(addLink.disabled).toBe(false));
		addLink.click();
		flush();

		expect(form.querySelector('form')).toBeNull();
		const input = container.querySelector<HTMLInputElement>('input')!;
		expect(form.checkValidity()).toBe(true);
		input.value = 'not a URL';
		input.dispatchEvent(new InputEvent('input', { bubbles: true }));
		flush();
		expect(form.checkValidity()).toBe(true);
		const invalidEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
		input.dispatchEvent(invalidEnter);
		flush();
		expect(invalidEnter.defaultPrevented).toBe(true);
		expect(container.querySelector('[role="alert"]')?.textContent).toContain('Enter an http, https, or mailto URL.');
		expect(onSubmit).not.toHaveBeenCalled();

		input.value = 'mailto:hello@example.org';
		input.dispatchEvent(new InputEvent('input', { bubbles: true }));
		flush();
		if (action === 'click') {
			[...container.querySelectorAll('button')].find((button) => button.textContent === 'Apply link')!.click();
		} else {
			const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
			input.dispatchEvent(enter);
			expect(enter.defaultPrevented).toBe(true);
		}
		flush();
		expect(container.querySelector('[aria-label="Insert link"]')).toBeNull();
		expect(onSubmit).not.toHaveBeenCalled();
		submit.click();
		expect(onSubmit).toHaveBeenCalledOnce();
	});
});
