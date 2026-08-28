import { describe, expect, it } from 'vitest';
import { createPublicError } from '~/platform/errors';
import { visibleError } from './visible-error';

describe('visibleError', () => {
	it('preserves local safe errors and serialized public server errors', () => {
		expect(visibleError(createPublicError('Invalid command.', 400), 'Fallback')).toBe('Invalid command.');

		const source = createPublicError('Email template not found.', 404);
		const serialized = Object.assign(new Error(source.message), JSON.parse(JSON.stringify(source)));
		expect(visibleError(serialized, 'Fallback')).toBe('Email template not found.');
	});

	it('does not expose arbitrary, network, or sanitized server errors', () => {
		expect(visibleError(new Error('postgres://secret@database/private'), 'Fallback')).toBe('Fallback');
		expect(visibleError(Object.assign(new Error('provider diagnostic'), { status: 502 }), 'Fallback')).toBe('Fallback');
		expect(
			visibleError(Object.assign(new Error('wrong brand'), { status: 400, publicErrorKind: 'another-app' }), 'Fallback'),
		).toBe('Fallback');
		expect(visibleError(Object.assign(new Error('Internal Server Error'), { status: 200 }), 'Fallback')).toBe('Fallback');
		expect(visibleError('raw error text', 'Fallback')).toBe('Fallback');
	});
});
