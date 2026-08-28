import { describe, expect, it } from 'vitest';
import { decodeOpaqueRouteSegment, encodeOpaqueRouteSegment } from './opaque-route-segment';

describe('opaque route segments', () => {
	it.each(['new', '.', '..', '~campaign', 'press kit', 'sale+fall', 'promo:fall', '%2F', '日本語', 'builtin:owner'])(
		'round-trips %j without URI decoding',
		(value) => {
			const encoded = encodeOpaqueRouteSegment(value);
			expect(encoded).toMatch(/^~h(?:[0-9a-f]{2})+$/);
			expect(decodeOpaqueRouteSegment(encoded)).toBe(value);
		},
	);

	it.each(['new', '~h', '~h1', '~hzz', '~hFF', '~hc328', '~h80', '~h6e6577%20'])(
		'rejects noncanonical or invalid segment %j',
		(segment) => expect(decodeOpaqueRouteSegment(segment)).toBe(''),
	);
});
