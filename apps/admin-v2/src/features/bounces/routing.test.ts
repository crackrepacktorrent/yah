import { describe, expect, it } from 'vitest';
import { bounceListHref, decodeBounceListLocation } from './routing';

describe('bounce-list routing', () => {
	it('canonicalizes absent and invalid pages', () => {
		expect(decodeBounceListLocation({})).toEqual({ page: 1 });
		expect(decodeBounceListLocation({ page: '-2' })).toEqual({ page: 1 });
		expect(decodeBounceListLocation({ page: '01' })).toEqual({ page: 1 });
		expect(decodeBounceListLocation({ page: ['2'] })).toEqual({ page: 1 });
		expect(decodeBounceListLocation({ page: '9007199254740992' })).toEqual({ page: 1 });
		expect(decodeBounceListLocation({ page: '10001' })).toEqual({ page: 1 });
	});

	it('round-trips canonical list links', () => {
		expect(bounceListHref({})).toBe('/emails/bounces');
		expect(bounceListHref({ page: 1 })).toBe('/emails/bounces');
		expect(bounceListHref({ page: 42 })).toBe('/emails/bounces?page=42');
		expect(decodeBounceListLocation({ page: '42' })).toEqual({ page: 42 });
	});
});
