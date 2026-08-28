import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { isPublicError } from './errors';
import { createPublicInputParser } from './public-input';

describe('public input parser', () => {
	it('returns schema-approved input', () => {
		const parse = createPublicInputParser('Invalid request.');
		const schema = v.strictObject({ name: v.pipe(v.string(), v.trim()) });

		expect(parse(schema, { name: '  YAH  ' })).toEqual({ name: 'YAH' });
	});

	it('turns schema issues into a public 400 response', () => {
		const parse = createPublicInputParser('Invalid request.');
		const schema = v.pipe(v.string(), v.nonEmpty('Enter a name.'));

		try {
			parse(schema, '');
			expect.unreachable('Expected invalid input to be rejected.');
		} catch (error) {
			expect(isPublicError(error)).toBe(true);
			expect(error).toMatchObject({ message: 'Enter a name.', status: 400 });
		}
	});
});
