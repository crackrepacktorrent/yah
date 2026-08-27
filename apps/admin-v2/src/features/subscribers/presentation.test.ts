import { describe, expect, it } from 'vitest';
import { safeActivityLinkHref } from './presentation';

describe('subscriber presentation', () => {
	it('links only absolute HTTP(S) activity targets', () => {
		expect(safeActivityLinkHref('https://example.test/story')).toBe('https://example.test/story');
		expect(safeActivityLinkHref('http://example.test/story')).toBe('http://example.test/story');
		for (const value of ['javascript:alert(1)', 'data:text/html,unsafe', '/relative', 'not a URL']) {
			expect(safeActivityLinkHref(value), value).toBeNull();
		}
	});
});
