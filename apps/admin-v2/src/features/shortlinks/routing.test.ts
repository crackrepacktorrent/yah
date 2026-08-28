import { describe, expect, it } from 'vitest';
import { decodeShortlinkRouteCode, encodeShortlinkRouteCode, shortlinkDetailHref } from './routing';

describe('shortlink management routes', () => {
	it.each(['new', '.', '..', '%2F'])('builds a collision-free detail path for %j', (shortCode) => {
		const encoded = encodeShortlinkRouteCode(shortCode);
		expect(decodeShortlinkRouteCode(encoded)).toBe(shortCode);
		expect(shortlinkDetailHref(shortCode)).toBe(`/shortlinks/${encoded}/details`);
	});
});
