import { describe, expect, test } from 'bun:test';
import { HttpError, surfaceError } from './http-errors';

describe('surfaceError', () => {
	test('preserves deliberately public errors', () => {
		const error = new HttpError('Not found', 404);

		expect(() => surfaceError(error, () => undefined)).toThrow(error);
	});

	test('logs and hides unexpected error details', () => {
		const logs: Array<{ message: string; error: unknown }> = [];
		let surfaced: unknown;

		try {
			surfaceError(new Error('postgres password leaked'), (message, error) => {
				logs.push({ message, error });
			});
		} catch (error) {
			surfaced = error;
		}

		expect(surfaced).toBeInstanceOf(HttpError);
		expect((surfaced as HttpError).status).toBe(500);
		expect((surfaced as HttpError).message).not.toContain('postgres password leaked');
		expect(logs).toHaveLength(1);
		expect(logs[0]?.message).toMatch(/^\[admin:[a-f0-9-]+\]/);
	});
});
