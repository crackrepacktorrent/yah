import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import { HttpError } from './http-errors';
import { idListSchema, parseInput, positiveIntegerSchema } from './validation';

describe('parseInput', () => {
	test('returns parsed output', () => {
		expect(parseInput(positiveIntegerSchema, 42)).toBe(42);
	});

	test('turns schema failures into public 400 errors', () => {
		let surfaced: unknown;

		try {
			parseInput(idListSchema, []);
		} catch (error) {
			surfaced = error;
		}

		expect(surfaced).toBeInstanceOf(HttpError);
		expect((surfaced as HttpError).status).toBe(400);
	});

	test('rejects unknown command fields when a strict schema is used', () => {
		const schema = v.strictObject({ id: positiveIntegerSchema });

		expect(() => parseInput(schema, { id: 1, admin: true })).toThrow(HttpError);
	});
});
