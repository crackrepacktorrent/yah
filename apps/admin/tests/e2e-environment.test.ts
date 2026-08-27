import { describe, expect, test } from 'bun:test';
import { getAuthEnvironment, getCurrentBaseUrl, getV2BaseUrl } from '../e2e/support/environment';

describe('Playwright environment', () => {
	test('uses a safe local current target and enables v2 only when configured', () => {
		expect(getCurrentBaseUrl({})).toBe('http://127.0.0.1:3002');
		expect(getV2BaseUrl({})).toBeNull();
		expect(getV2BaseUrl({ ADMIN_V2_E2E_BASE_URL: 'https://admin-v2.example.test' })).toBe(
			'https://admin-v2.example.test',
		);
	});

	test('rejects target URLs containing paths or credentials', () => {
		expect(() => getCurrentBaseUrl({ ADMIN_E2E_BASE_URL: 'https://example.test/admin' })).toThrow(
			'without a path, query, or fragment',
		);
		expect(() => getCurrentBaseUrl({ ADMIN_E2E_BASE_URL: 'https://user:secret@example.test' })).toThrow(
			'without embedded credentials',
		);
	});

	test('skips authenticated parity explicitly when credentials are absent', () => {
		const result = getAuthEnvironment({});
		expect(result.credentials).toBeNull();
		expect(result.skipReason).toContain('set both ADMIN_E2E_EMAIL and ADMIN_E2E_PASSWORD');
	});

	test('fails partial or malformed authenticated configuration', () => {
		expect(() => getAuthEnvironment({ ADMIN_E2E_EMAIL: 'reader@example.test' })).toThrow('configuration is incomplete');
		expect(() =>
			getAuthEnvironment({ ADMIN_E2E_EMAIL: 'not-an-email', ADMIN_E2E_PASSWORD: 'secret' }),
		).toThrow('must be a valid email address');
	});

	test('returns a complete authenticated configuration without logging it', () => {
		const result = getAuthEnvironment({
			ADMIN_E2E_EMAIL: ' reader@example.test ',
			ADMIN_E2E_PASSWORD: 'test-only-secret',
		});
		expect(result.credentials?.email).toBe('reader@example.test');
		expect(result.credentials?.password).toBe('test-only-secret');
		expect(result.skipReason).toBeNull();
	});
});
