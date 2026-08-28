import { authenticatedTestSkipReason, expect, test } from './support/authenticated';

test.describe('authenticated parity', () => {
	test.skip(authenticatedTestSkipReason !== null, authenticatedTestSkipReason ?? 'Authenticated parity is enabled.');

	test('a valid session reaches the authenticated application shell', async ({ authenticatedPage }) => {
		await expect(authenticatedPage).toHaveURL((url) => url.pathname === '/');
		await expect(authenticatedPage.locator('main')).toBeVisible();
		await expect(authenticatedPage.getByRole('button', { name: 'Sign out' }).first()).toBeVisible();
	});
});
