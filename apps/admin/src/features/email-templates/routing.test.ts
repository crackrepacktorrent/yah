import { describe, expect, it } from 'vitest';
import { decodeEmailTemplateRouteId, emailTemplateHref } from './routing';

describe('email-template routing', () => {
	it('round-trips positive safe IDs', () => {
		expect(emailTemplateHref(42)).toBe('/emails/templates/42');
		expect(decodeEmailTemplateRouteId('42')).toBe(42);
	});

	it.each(['', '0', '-1', '01', '1.5', 'abc', '9007199254740992'])('rejects noncanonical ID %s', (value) => {
		expect(decodeEmailTemplateRouteId(value)).toBe(0);
	});
});
