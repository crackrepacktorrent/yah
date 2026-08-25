import { generate, parse } from 'css-tree';

// A style element is an HTML raw-text element. Any case-variant of this byte
// sequence terminates it before CSS parsing matters.
const STYLE_END_TAG = /<\/style/i;

/**
 * Parse and normalize editor-authored CSS before it reaches an HTML response.
 * App defaults deliberately use zero-specificity :where(...) selectors, so
 * ordinary :root/body/heading rules authored here win without rewriting them.
 */
export function validateCustomCss(source: string): string {
	const css = source.trim();
	if (!css) return '';
	if (STYLE_END_TAG.test(css)) {
		throw new Error('Custom CSS cannot contain a closing style tag');
	}

	const normalized = generate(
		parse(css, {
			context: 'stylesheet',
			positions: false,
			onParseError(reason) {
				throw reason;
			}
		})
	);
	// Re-check generated output in case normalization materialized a raw end tag
	// from an otherwise non-literal representation.
	if (STYLE_END_TAG.test(normalized)) {
		throw new Error('Custom CSS cannot contain a closing style tag');
	}

	return normalized;
}
