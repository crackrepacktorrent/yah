import { expect, test as base, type Page } from '@playwright/test';
import { getAuthEnvironment } from './environment';

const authEnvironment = getAuthEnvironment();

export const authenticatedTestSkipReason = authEnvironment.skipReason;

async function signIn(page: Page): Promise<void> {
	if (!authEnvironment.credentials) {
		throw new Error(authEnvironment.skipReason);
	}

	await page.goto('/login');
	await page.getByLabel('Email').fill(authEnvironment.credentials.email);
	await page.getByLabel('Password').fill(authEnvironment.credentials.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 15_000 });
}

export const test = base.extend<{ authenticatedPage: Page }>({
	authenticatedPage: async ({ page }, use) => {
		await signIn(page);
		await use(page);
	},
});

export { expect };
