import { isSafeError } from '@solidjs/web';
import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';
import { isPublicError, surfaceError } from '~/platform/errors';
import { describeProviderIssue } from './provider-contract.server';
import { createProviderResponseParser } from './provider-response.server';

describe('provider response parser', () => {
	it('returns only schema-approved provider data', () => {
		const parse = createProviderResponseParser('Example');
		const schema = v.strictObject({ id: v.pipe(v.number(), v.safeInteger(), v.minValue(1)) });

		expect(parse(schema, { id: 7 }, 'item')).toEqual({ id: 7 });
	});

	it('names the field that broke the contract so the failure is diagnosable', () => {
		const parse = createProviderResponseParser('Example');
		const schema = v.strictObject({ token: v.string() });

		expect(() => parse(schema, { token: 42 }, 'login')).toThrow(
			'Example returned an invalid login response at token (expected string).',
		);
	});

	it('never puts the received provider payload into the operator-visible message', () => {
		const parse = createProviderResponseParser('Example');
		const schema = v.strictObject({ token: v.string(), recipient: v.string() });

		let thrown: unknown;
		try {
			parse(schema, { token: 'sk-live-do-not-surface', recipient: 42 }, 'login');
		} catch (error) {
			thrown = error;
		}

		const message = (thrown as Error).message;
		expect(message).toContain('at recipient');
		expect(message).not.toContain('sk-live-do-not-surface');
		expect(message).not.toContain('42');
	});

	it('reaches the operator instead of collapsing into a reference id', () => {
		const parse = createProviderResponseParser('Example');
		const schema = v.strictObject({ token: v.string() });
		const log = vi.fn();

		let thrown: unknown;
		try {
			parse(schema, { token: 42 }, 'login');
		} catch (error) {
			thrown = error;
		}

		// Safe errors pass through surfaceError untouched; unsafe ones are logged
		// and replaced with an opaque reference id.
		expect(isSafeError(thrown)).toBe(true);
		expect(() => surfaceError(thrown, log)).toThrow('at token (expected string)');
		expect(log).not.toHaveBeenCalled();
		expect(isPublicError(thrown)).toBe(true);
		expect((thrown as { status: number }).status).toBe(502);
	});

	it('degrades to the bare subject when an issue carries no usable location', () => {
		expect(describeProviderIssue(undefined)).toBe('');
		expect(describeProviderIssue([])).toBe('');
	});
});
