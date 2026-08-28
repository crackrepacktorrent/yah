import { describe, expect, it } from 'vitest';
import { decodeMailingListRouteId, mailingListHref } from './routing';

describe('mailing-list routing', () => {
	it('round-trips positive safe IDs', () => {
		expect(mailingListHref(42)).toBe('/emails/lists/42');
		expect(decodeMailingListRouteId('42')).toBe(42);
	});

	it.each(['', '0', '-1', '01', '1.5', 'abc', '9007199254740992'])('rejects noncanonical ID %s', (value) => {
		expect(decodeMailingListRouteId(value)).toBe(0);
	});
});
