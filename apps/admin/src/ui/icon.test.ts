import { createComponent, render } from '@solidjs/web';
import { flush } from 'solid-js';
import { afterEach, describe, expect, test } from 'vitest';
import { Icon, navIcons, uiIcons, type IconProps } from './icon';

const disposers: Array<() => void> = [];

function mountIcon(props: IconProps): SVGSVGElement {
	const container = document.createElement('div');
	document.body.append(container);
	disposers.push(() => container.remove());
	disposers.push(render(() => createComponent(Icon, props), container));
	flush();
	const svg = container.querySelector('svg');
	if (!svg) throw new Error('Icon did not render an svg element.');
	return svg;
}

afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
});

describe('icon renderer', () => {
	test('renders decorative icons that assistive technology and focus order skip', () => {
		const svg = mountIcon({ node: navIcons.dashboard });

		expect(svg.getAttribute('aria-hidden')).toBe('true');
		expect(svg.getAttribute('focusable')).toBe('false');
		expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
		expect(svg.getAttribute('stroke-width')).toBe('2');
		expect(svg.getAttribute('width')).toBe('24');
		expect(svg.getAttribute('role')).toBeNull();
		expect(svg.querySelector('title')).toBeNull();
	});

	test('promotes a labelled icon to an image with an accessible name', () => {
		const svg = mountIcon({ node: uiIcons.lock, label: 'Locked feature', size: 20, strokeWidth: 1.5, class: 'gallery-icon' });

		expect(svg.getAttribute('role')).toBe('img');
		expect(svg.getAttribute('aria-label')).toBe('Locked feature');
		expect(svg.getAttribute('aria-hidden')).toBeNull();
		expect(svg.querySelector('title')?.textContent).toBe('Locked feature');
		expect(svg.getAttribute('width')).toBe('20');
		expect(svg.getAttribute('stroke-width')).toBe('1.5');
		expect(svg.getAttribute('class')).toBe('gallery-icon');
	});

	test('renders every navigation and ui icon from framework-neutral node data', () => {
		expect(Object.keys(navIcons)).toHaveLength(14);

		for (const [name, node] of Object.entries({ ...navIcons, ...uiIcons })) {
			const svg = mountIcon({ node });
			expect(svg.childElementCount, name).toBeGreaterThan(0);
			expect(svg.getAttribute('fill'), name).toBe('none');
			expect(svg.getAttribute('stroke'), name).toBe('currentColor');
		}
	});
});
