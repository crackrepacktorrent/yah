import { defineConfig, devices } from '@playwright/test';

const port = 43121;
const disabledPort = 43122;
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'];
const bunExecutable = process.env['ADMIN_V2_E2E_BUN_EXECUTABLE'] ?? 'bun';

if (!/^[\w./-]+$/.test(bunExecutable)) throw new Error('ADMIN_V2_E2E_BUN_EXECUTABLE must be a plain executable path.');

export default defineConfig({
	testDir: './e2e',
	testIgnore: '**/*.production.spec.ts',
	fullyParallel: true,
	forbidOnly: !!process.env['CI'],
	retries: process.env['CI'] ? 1 : 0,
	reporter: 'list',
	use: {
		...devices['Desktop Chrome'],
		baseURL: `http://127.0.0.1:${port}`,
		launchOptions: executablePath ? { executablePath } : undefined,
		trace: 'on-first-retry',
	},
	webServer: [
		{
			command: `env ADMIN_V2_RUNTIME=compatibility-lab ADMIN_V2_COMPATIBILITY_AUTH_SECRET=solid-2-compatibility-e2e-secret ${bunExecutable} run start --host 127.0.0.1 --port ${port}`,
			url: `http://127.0.0.1:${port}/api/health`,
			reuseExistingServer: false,
			timeout: 30_000,
		},
		{
			command: `env ADMIN_V2_RUNTIME=platform-disabled ${bunExecutable} run start --host 127.0.0.1 --port ${disabledPort}`,
			url: `http://127.0.0.1:${disabledPort}/api/health`,
			reuseExistingServer: false,
			timeout: 30_000,
		},
	],
});
