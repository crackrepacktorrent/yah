import { defineConfig, devices } from '@playwright/test';
import { requireDisposableProductionE2EDatabase } from './e2e/production-environment';

requireDisposableProductionE2EDatabase();

const productionPort = 43123;
const upstreamPort = 43124;
const upstreamOrigin = `http://127.0.0.1:${upstreamPort}`;
const externalProductionOrigin = process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'];
const productionOrigin = externalProductionOrigin ?? `http://127.0.0.1:${productionPort}`;
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'];
const bunExecutable = process.env['ADMIN_V2_E2E_BUN_EXECUTABLE'] ?? 'bun';

if (!/^[\w./-]+$/.test(bunExecutable)) throw new Error('ADMIN_V2_E2E_BUN_EXECUTABLE must be a plain executable path.');

const webServer = externalProductionOrigin
	? []
	: [
			{
				command: `${bunExecutable} e2e/production-upstream.ts`,
				url: `${upstreamOrigin}/health`,
				reuseExistingServer: false,
				timeout: 30_000,
			},
			{
				command: `env ADMIN_V2_RUNTIME=production LISTMONK_URL=${upstreamOrigin} LISTMONK_API_TOKEN=admin:fixture-listmonk-secret SHLINK_URL=${upstreamOrigin} SHLINK_API_KEY=fixture-shlink-secret UMAMI_URL=${upstreamOrigin} UMAMI_WEBSITE_ID=website/id ${bunExecutable} run start --host 127.0.0.1 --port ${productionPort}`,
				url: `${productionOrigin}/api/health`,
				reuseExistingServer: false,
				timeout: 30_000,
			},
		];

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.production.spec.ts',
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env['CI'],
	retries: process.env['CI'] ? 1 : 0,
	reporter: 'list',
	use: {
		...devices['Desktop Chrome'],
		baseURL: productionOrigin,
		extraHTTPHeaders: { 'x-forwarded-for': '127.0.0.1' },
		launchOptions: executablePath ? { executablePath } : undefined,
		timezoneId: 'America/Chicago',
		trace: 'on-first-retry',
	},
	webServer,
});
