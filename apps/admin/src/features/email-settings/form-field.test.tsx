import { createComponent, render } from '@solidjs/web';
import { afterEach, describe, expect, it } from 'vitest';
import { InputField } from '~/ui/form-field';

const disposers: Array<() => void> = [];
afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
});

describe('InputField', () => {
	it('keeps helper text out of the accessible label and associates it as a description', () => {
		const container = document.createElement('div');
		document.body.append(container);
		disposers.push(() => container.remove());
		disposers.push(render(() => createComponent(InputField, {
			label: 'Password',
			help: 'Leave blank to retain the saved credential.',
			type: 'password',
			'aria-describedby': 'external-description',
		}), container));

		const input = container.querySelector('input');
		expect(input?.labels?.[0]?.textContent).toBe('Password');
		const descriptionIds = input?.getAttribute('aria-describedby')?.split(' ') ?? [];
		expect(descriptionIds[0]).toBe('external-description');
		expect(descriptionIds).toHaveLength(2);
		expect(document.getElementById(descriptionIds[1]!)?.textContent).toBe('Leave blank to retain the saved credential.');
	});
});
