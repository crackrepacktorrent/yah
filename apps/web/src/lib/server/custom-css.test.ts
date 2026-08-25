import { describe, expect, test } from 'bun:test';
import { renderCustomCssStyle, validateCustomCss } from './custom-css';

describe('validateCustomCss', () => {
	test('keeps root variables overrideable without selector rewriting', () => {
		expect(validateCustomCss(':root { --color-link: brown; }')).toBe(
			':root{--color-link: brown}'
		);
	});

	test('keeps page and component selectors available for scoped overrides', () => {
		expect(validateCustomCss('.press-page { --color-link: #522b1c; }')).toBe(
			'.press-page{--color-link: #522b1c}'
		);
	});

	test('rejects attempts to escape the style element', () => {
		expect(() =>
			validateCustomCss('body { color: red; }</style><script>alert(1)</script>')
		).toThrow('closing style tag');
		expect(() => validateCustomCss('/* </StYlE > */ body { color: red }')).toThrow(
			'closing style tag'
		);
	});

	test('rejects invalid CSS', () => {
		expect(() => validateCustomCss('body { color: red; } }')).toThrow();
	});

	test('renders validated CSS as the style element contents', () => {
		expect(renderCustomCssStyle(':root { --color-link: brown; }')).toBe(
			'<style data-storyblok-custom-css>:root{--color-link: brown}</style>'
		);
		expect(renderCustomCssStyle('')).toBe('');
	});
});
