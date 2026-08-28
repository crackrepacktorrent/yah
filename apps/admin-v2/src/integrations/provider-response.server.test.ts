import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { createProviderResponseParser } from './provider-response.server';

describe('provider response parser', () => {
	it('returns only schema-approved provider data', () => {
		const parse = createProviderResponseParser('Example');
		const schema = v.strictObject({ id: v.pipe(v.number(), v.safeInteger(), v.minValue(1)) });

		expect(parse(schema, { id: 7 }, 'item')).toEqual({ id: 7 });
	});

	it('keeps invalid provider details behind a private infrastructure error', () => {
		const parse = createProviderResponseParser('Example');
		const schema = v.strictObject({ token: v.string() });

		expect(() => parse(schema, { token: 42, secret: 'do-not-surface' }, 'login')).toThrow(
			'Example returned an invalid login response.',
		);
	});
});
