const confirmation = 'mutate-and-clean-disposable-production-e2e-database';

function databaseNameFromUrl(databaseUrl: string): string | null {
	if (databaseUrl.startsWith('socket:')) {
		const queryIndex = databaseUrl.indexOf('?');
		return queryIndex === -1 ? null : new URLSearchParams(databaseUrl.slice(queryIndex + 1)).get('db');
	}

	try {
		return new URL(databaseUrl).pathname.slice(1) || null;
	} catch {
		return null;
	}
}

/** Refuse every production E2E process before Playwright can spawn a server. */
export function requireDisposableProductionE2EDatabase(environment: NodeJS.ProcessEnv = process.env): string {
	const databaseUrl = environment['DATABASE_URL'];
	if (!databaseUrl) throw new Error('DATABASE_URL is required for the production browser suite.');
	if (environment['ADMIN_V2_PRODUCTION_E2E_CONFIRMATION'] !== confirmation) {
		throw new Error('Refusing to start production browser tests without the exact confirmation phrase.');
	}
	if (!databaseNameFromUrl(databaseUrl)?.endsWith('_test')) {
		throw new Error('Production browser tests require a database ending in _test.');
	}
	return databaseUrl;
}
