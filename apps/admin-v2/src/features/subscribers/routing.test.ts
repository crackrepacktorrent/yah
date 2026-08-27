import { describe, expect, it } from 'vitest';
import { decodeSubscriberListLocation, decodeSubscriberRouteId, subscriberHref, subscriberListHref } from './routing';

describe('subscriber routing', () => {
	it('round-trips positive safe IDs', () => {
		expect(subscriberHref(42)).toBe('/emails/subscribers/42');
		expect(decodeSubscriberRouteId('42')).toBe(42);
	});

	it.each(['', '0', '-1', '01', '1.5', 'abc', '9007199254740992'])('rejects noncanonical ID %s', (value) => {
		expect(decodeSubscriberRouteId(value)).toBe(0);
	});
});

describe('subscriber list routing', () => {
	it('canonicalizes invalid pages and trims bounded searches', () => {
		expect(decodeSubscriberListLocation({ page: '-2', search: '  Ada  ' })).toEqual({ page: 1, search: 'Ada' });
		expect(decodeSubscriberListLocation({ page: '2', search: ['ignored'] })).toEqual({ page: 2, search: '' });
		expect(decodeSubscriberListLocation({ page: '9007199254740992' })).toEqual({ page: 1, search: '' });
		expect(decodeSubscriberListLocation({ page: '10001' })).toEqual({ page: 1, search: '' });
		expect(decodeSubscriberListLocation({ search: 'x'.repeat(240) }).search).toHaveLength(200);
	});

	it('builds canonical list links with encoded server query state', () => {
		expect(subscriberListHref({})).toBe('/emails/subscribers');
		expect(subscriberListHref({ page: 1, search: '  ' })).toBe('/emails/subscribers');
		expect(subscriberListHref({ page: 3, search: 'ada+review@example.com' })).toBe('/emails/subscribers?search=ada%2Breview%40example.com&page=3');
	});
});
