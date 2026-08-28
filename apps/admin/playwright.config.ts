import { defineConfig, devices } from '@playwright/test';
import { getCurrentBaseUrl, getV2BaseUrl } from './e2e/support/environment';

const currentBaseUrl = getCurrentBaseUrl();
const v2BaseUrl = getV2BaseUrl();
const isCI = !!process.env['CI'];

function browserProject(name: string, baseURL: string) {
	return {
		name,
		use: {
			...devices['Desktop Chrome'],
			baseURL,
		},
	};
}

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.spec.ts',
	outputDir: './test-results',
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 1 : 0,
	reporter: isCI
		? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
		: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
	use: {
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		navigationTimeout: 15_000,
		actionTimeout: 10_000,
	},
	projects: [browserProject('current', currentBaseUrl), ...(v2BaseUrl ? [browserProject('v2', v2BaseUrl)] : [])],
});
