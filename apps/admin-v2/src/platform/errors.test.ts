import { isSafeError } from '@solidjs/web';
import { describe, expect, it, vi } from 'vitest';
import { createPublicError, isPublicError, surfaceError } from './errors';

describe('server error boundary', () => {
	it('preserves deliberately public branded errors', () => {
		const error = createPublicError('Invalid command.', 400);
		expect(isSafeError(error)).toBe(true);
		expect(isPublicError(error)).toBe(true);
		expect(Object.keys(error)).toEqual(expect.arrayContaining(['publicErrorKind', 'status']));
		expect(() => surfaceError(error)).toThrow(error);
	});

	it('logs unexpected details and exposes only a reference', () => {
		const log = vi.fn();
		let surfaced: unknown;
		try {
			surfaceError(new Error('postgres://secret@database/private'), log);
		} catch (error) {
			surfaced = error;
		}

		expect(surfaced).toBeInstanceOf(Error);
		expect(isSafeError(surfaced)).toBe(true);
		expect((surfaced as Error).message).toMatch(/^An unexpected error occurred\. Reference: [a-f0-9]{8}$/);
		expect((surfaced as Error).message).not.toContain('postgres');
		expect(log).toHaveBeenCalledOnce();
	});
});
