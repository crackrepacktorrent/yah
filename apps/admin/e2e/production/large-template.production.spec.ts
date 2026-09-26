import { expect, test, ownerEmail, ownerPassword, upstreamOrigin } from '../production-test';

test('large accepted template bodies survive the server-function transport', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_PRODUCTION_E2E_BASE_URL'], 'Large-template assertions require the disposable local fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({ 'x-forwarded-for': `127.0.0.${85 + testInfo.retry}` });
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await page.goto('/emails/templates/new');
	await page.getByLabel(/Name/).fill('Large transport fixture');
	await page.getByLabel('Subject').fill('Large template transport');
	// Above Solid's default 1 MiB transport cap, within the app's 5 MB contract.
	const body = `<p>Large template transport</p><!--${'x'.repeat(1_100_000)}-->`;
	await page.getByLabel('Body (HTML)').fill(body);
	await page.getByRole('button', { name: 'Create template' }).click();
	await expect(page.getByRole('heading', { name: 'Large transport fixture' })).toBeVisible();
	await page.reload();
	await expect(page.getByLabel('Body (HTML)')).toHaveValue(body);
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await page.getByRole('dialog', { name: 'Delete email template?' }).getByRole('button', { name: 'Delete template' }).click();
	await expect(page).toHaveURL(/\/emails$/);
});
