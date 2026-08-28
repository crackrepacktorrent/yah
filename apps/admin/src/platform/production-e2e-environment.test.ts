import { describe, expect, it } from 'vitest';
import { requireDisposableProductionE2EDatabase } from '../../e2e/production-environment';

const exactConfirmation = 'mutate-and-clean-disposable-production-e2e-database';

function environment(databaseUrl: string, confirmation = exactConfirmation): NodeJS.ProcessEnv {
	return {
		ADMIN_PRODUCTION_E2E_CONFIRMATION: confirmation,
		DATABASE_URL: databaseUrl,
	};
}

describe('production browser database guard', () => {
	it('accepts an explicitly confirmed TCP test database', () => {
		const databaseUrl = 'postgres://yah:secret@127.0.0.1:5432/yah_admin_test';
		expect(requireDisposableProductionE2EDatabase(environment(databaseUrl))).toBe(databaseUrl);
	});

	it('accepts an explicitly confirmed Unix-socket test database', () => {
		const databaseUrl = 'socket://yah:secret@/tmp/postgres?db=yah_admin_routes_test';
		expect(requireDisposableProductionE2EDatabase(environment(databaseUrl))).toBe(databaseUrl);
	});

	it('rejects a missing or inexact confirmation', () => {
		expect(() => requireDisposableProductionE2EDatabase(environment('postgres://localhost/yah_test', 'wrong'))).toThrow(
			'exact confirmation phrase',
		);
	});

	it('rejects production, missing, and malformed database names', () => {
		expect(() => requireDisposableProductionE2EDatabase(environment('postgres://localhost/yah'))).toThrow('ending in _test');
		expect(() => requireDisposableProductionE2EDatabase(environment('socket://yah:secret@/tmp/postgres'))).toThrow(
			'ending in _test',
		);
		expect(() => requireDisposableProductionE2EDatabase(environment('not a URL'))).toThrow('ending in _test');
	});
});
