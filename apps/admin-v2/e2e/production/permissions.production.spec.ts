import { expect, test, canonicalOrganizationId, deniedEmail, isolatedEmail, ownerPassword, upstreamOrigin } from '../production-test';

test('create and edit capabilities remain independently usable without view access', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'Deterministic Shlink assertions require the local fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${60 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(isolatedEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Shortlinks' })).toHaveCount(0);

	await page.goto('/shortlinks/new');
	await expect(page.getByRole('heading', { name: 'New shortlink' })).toBeVisible();
	await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'Dashboard' })).toBeVisible();
	await page.getByLabel(/Destination URL/).fill('https://example.test/reserved-route-code');
	await page.getByLabel(/Custom short code/).fill('new');
	await page.getByRole('button', { name: 'Create shortlink' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('status').filter({ hasText: 'Shortlink new created.' })).toBeVisible();

	await page.goto('/shortlinks/~h6e6577/edit');
	await expect(page.getByRole('heading', { name: 'Edit new' })).toBeVisible();
	await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: 'Dashboard' })).toBeVisible();
	await page.getByLabel(/Title/).fill('Reserved route code');
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('status').filter({ hasText: 'Shortlink updated.' })).toBeVisible();

	await page.goto('/shortlinks/new');
	await page.getByLabel(/Destination URL/).fill('https://example.test/literal-percent-code');
	await page.getByLabel(/Custom short code/).fill('%2F');
	await page.getByRole('button', { name: 'Create shortlink' }).click();
	await expect(page).toHaveURL(/\/$/);
	await page.goto('/shortlinks/~h253246/edit');
	await expect(page.getByRole('heading', { name: 'Edit %2F' })).toBeVisible();

	await page.goto('/shortlinks/~h6e6577/details');
	await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
	await page.goto('/emails');
	await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
	await expect(page.getByRole('table', { name: 'Email templates' })).toHaveCount(0);
	await request.post(`${upstreamOrigin}/__control/reset`);
});

test('a canonical member without analytics permission has scoped read and set-default access', async ({ page, request }, testInfo) => {
	const alternate = await request.post(`${upstreamOrigin}/api/templates`, {
		headers: { authorization: 'token admin:fixture-listmonk-secret' },
		data: {
			name: 'Alternate campaign',
			type: 'campaign',
			subject: '',
			body: '<main>{{ template "content" . }}</main>',
		},
	});
	expect(alternate.status()).toBe(200);
	const alternateId = ((await alternate.json()) as { data: { id: number } }).data.id;
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${40 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(deniedEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Analytics' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Email' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Shortlinks' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Recent shortlinks' })).toBeVisible();
	await page.getByRole('link', { name: 'Shortlinks' }).click();
	await expect(page.getByRole('link', { name: 'New shortlink' })).toHaveCount(0);
	await page.getByRole('link', { name: 'press-kit' }).click();
	await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Reset visits' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
	await page.goto('/shortlinks/new');
	await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();

	const rawOrganizationStatuses = await page.evaluate(async (organizationId) => {
		const readPaths = [
			'/api/auth/organization/list-members',
			'/api/auth/organization/list-invitations',
			'/api/auth/organization/get-full-organization',
			'/api/auth/organization/get-active-member-role',
		] as const;
		const readStatuses = await Promise.all(
			readPaths.map(async (pathname) => {
				const response = await fetch(`${pathname}?organizationId=${encodeURIComponent(organizationId)}`, {
					cache: 'no-store',
				});
				return [pathname, response.status] as const;
			}),
		);
		const permissionPath = '/api/auth/organization/has-permission';
		const permissionResponse = await fetch(permissionPath, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				organizationId,
				permissions: { analytics: ['view'] },
			}),
		});
		return Object.fromEntries([...readStatuses, [permissionPath, permissionResponse.status] as const]);
	}, canonicalOrganizationId);
	expect(rawOrganizationStatuses).toEqual({
		'/api/auth/organization/list-members': 404,
		'/api/auth/organization/list-invitations': 404,
		'/api/auth/organization/get-full-organization': 404,
		'/api/auth/organization/get-active-member-role': 404,
		'/api/auth/organization/has-permission': 404,
	});

	await page.goto('/analytics');
	await expect(page.getByRole('alert')).toContainText('Analytics for this period could not be loaded.');
	await expect(page.locator('.analytics-results')).toHaveCount(0);
	await page.goto('/emails');
	await expect(page.getByRole('table', { name: 'Email templates' })).toBeVisible();
	await page.getByRole('link', { name: 'Alternate campaign' }).click();
	await expect(page).toHaveURL(new RegExp(`/emails/templates/${alternateId}$`));
	await expect(page.getByLabel('Body (HTML)')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Set as default' })).toBeVisible();

	await request.post(`${upstreamOrigin}/__control/fail-next?provider=listmonk`);
	await page.getByRole('button', { name: 'Set as default' }).click();
	await expect(page.getByRole('alert')).toContainText(/An unexpected error occurred\. Reference: [a-f0-9]{8}/);
	await expect(page.getByRole('alert')).not.toContainText('fixture confidential listmonk diagnostic');
	await page.getByRole('button', { name: 'Set as default' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Default campaign template updated.' })).toBeVisible();

	const emailNavigation = page.getByLabel('Email management');
	await emailNavigation.getByRole('link', { name: 'Lists' }).click();
	await expect(page.getByRole('table', { name: 'Mailing lists' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'New list' })).toHaveCount(0);
	await page.getByRole('link', { name: 'Press announcements' }).click();
	await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
	await expect(page.getByText('press, announcements')).toBeVisible();
	await emailNavigation.getByRole('link', { name: 'Forms' }).click();
	await expect(page.getByRole('heading', { name: 'Subscription forms' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Publish' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Make private' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
});
