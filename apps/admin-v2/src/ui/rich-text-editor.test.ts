import { createComponent, render } from '@solidjs/web';
import { describe, expect, test, vi } from 'vitest';
import { RichTextEditor } from './rich-text-editor';

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
});
