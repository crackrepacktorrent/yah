import { expect, test, type Page } from '@playwright/test';

function pathname(page: Page): string {
	return new URL(page.url()).pathname;
}

test('readiness endpoint reports a healthy database-backed application', async ({ request }) => {
	const response = await request.get('/api/health');
	const body = await response.text();

	expect(response.status(), body).toBe(200);
	expect(response.headers()['content-type']).toContain('application/json');
	expect(JSON.parse(body)).toEqual({ status: 'ok' });
});

test('login exposes stable semantics and native form validation', async ({ page }) => {
	const response = await page.goto('/login');
	if (!response) throw new Error('Login navigation did not produce a response');
	expect(response.status()).toBeLessThan(500);

	const email = page.getByLabel('Email');
	const password = page.getByLabel('Password');
	const submit = page.getByRole('button', { name: 'Sign in' });

	await expect(email).toBeVisible();
	await expect(email).toHaveAttribute('type', 'email');
	await expect(password).toBeVisible();
	await expect(password).toHaveAttribute('type', 'password');
	await expect(submit).toBeVisible();
	await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password');

	await email.focus();
	await expect(email).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(password).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(submit).toBeFocused();

	await email.fill('not-an-email');
	await password.fill('not-a-real-password');
	await password.press('Enter');

	const emailValidity = await email.evaluate((input: HTMLInputElement) => ({
		required: input.required,
		typeMismatch: input.validity.typeMismatch,
		valid: input.validity.valid,
	}));
	expect(emailValidity).toEqual({ required: true, typeMismatch: true, valid: false });
	expect(pathname(page)).toBe('/login');
});

test('an unauthenticated protected direct load redirects to login', async ({ page }) => {
	await page.goto('/?source=playwright-direct-load');
	await expect(page).toHaveURL((url) => url.pathname === '/login');
	await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('an unknown direct load remains safe and never exposes the authenticated shell', async ({ page }) => {
	const pageErrors: Error[] = [];
	page.on('pageerror', (error) => pageErrors.push(error));

	const missingPath = '/__playwright_missing_route__';
	const response = await page.goto(missingPath);
	if (!response) throw new Error('Missing-route navigation did not produce a response');

	expect(response.status()).toBeLessThan(500);
	expect(pathname(page)).toBe(missingPath);
	await expect(page.locator('body')).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
	expect(pageErrors).toEqual([]);
});
