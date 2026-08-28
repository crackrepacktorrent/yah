import {
	expect,
	test,
	compatibilityOrigin,
	expectNoDocumentOverflow,
	expectSelectedEmailSection,
	expectSelectedPrimarySection,
	ownerEmail,
	ownerPassword,
	productionOrigin,
} from '../production-test';

test('production serves only its completed routes and public assets', async ({ request }) => {
	const health = await request.get('/api/health');
	expect(health.status()).toBe(200);
	expect(await health.json()).toEqual({ app: 'yah-admin-v2', status: 'ok' });

	const logo = await request.get('/logo.svg');
	expect(logo.status()).toBe(200);
	expect(logo.headers()['content-type']).toContain('image/svg+xml');

	for (const path of ['/index.html', '/compatibility', '/compatibility/table', '/api/adapter-probe', '/static-probe.txt']) {
		const response = await request.get(path);
		expect(response.status(), path).toBe(404);
	}

	const serverPut = await request.put('/_server');
	expect(serverPut.status()).toBe(405);
	expect(serverPut.headers()['allow']).toBe('GET, POST');

	const pagePost = await request.post('/login');
	expect(pagePost.status()).toBe(405);
	expect(pagePost.headers()['allow']).toBe('GET, HEAD');
});

test('anonymous product pages redirect safely and disclose no invitation details', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/login$/);
	await expect(page).toHaveTitle('YAH Admin');
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
	expect(await page.locator('img.auth-logo').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);

	await page.goto('/members/accept/not-a-real-invitation');
	await expect(page.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible();
	await expect(page.getByText(ownerEmail)).toHaveCount(0);

	await page.goto('/reset-password');
	await expect(page.getByRole('heading', { name: 'Invalid reset link' })).toBeVisible();
});

test('owner login activates the canonical organization and guest routes redirect without a form flash', async ({ page }, testInfo) => {
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${10 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill('incorrect-password');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('alert')).toBeVisible();
	await expect(page).toHaveURL(/\/login$/);

	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await expect(page.getByText(ownerEmail)).toBeVisible();

	await page.goto('/login');
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('primary and email navigation expose current state without overflowing narrow screens', async ({ page }, testInfo) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${45 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expectSelectedPrimarySection(page, 'Dashboard');
	const primaryNavigation = page.getByLabel('Primary navigation');
	for (const name of ['Dashboard', 'Analytics', 'Shortlinks', 'Email', 'Roles', 'Members', 'Settings']) {
		const link = primaryNavigation.getByRole('link', { name, exact: true });
		await link.scrollIntoViewIfNeeded();
		await expect(link).toBeVisible();
	}
	await expectNoDocumentOverflow(page);

	await primaryNavigation.getByRole('link', { name: 'Email', exact: true }).click();
	await expectSelectedPrimarySection(page, 'Email');
	await expectSelectedEmailSection(page, 'Templates');
	const emailNavigation = page.getByLabel('Email management');
	for (const name of ['Campaigns', 'Email analytics', 'Templates', 'Lists', 'Forms', 'Subscribers', 'Bounces', 'Logs']) {
		const link = emailNavigation.getByRole('link', { name, exact: true });
		await link.scrollIntoViewIfNeeded();
		await expect(link).toBeVisible();
	}
	await expectNoDocumentOverflow(page);
});

test('a compatibility server-function request is rejected by the production runtime', async ({ browser, request }) => {
	const page = await browser.newPage();
	try {
		await page.goto(`${compatibilityOrigin}/compatibility`);
		await page.getByLabel('Mutation label').fill('must stay in the lab');

		const capturedPromise = page.waitForRequest((candidate) => candidate.method() === 'POST' && new URL(candidate.url()).pathname === '/_server');
		const responsePromise = page.waitForResponse((candidate) => candidate.request().method() === 'POST' && new URL(candidate.url()).pathname === '/_server');
		await page.getByRole('button', { name: 'Run typed mutation' }).click();
		const captured = await capturedPromise;
		await responsePromise;
		await expect(page.getByRole('status')).toHaveText('Accepted: must stay in the lab');

		const sourceHeaders = await captured.allHeaders();
		const forwardedHeaders = Object.fromEntries(Object.entries(sourceHeaders).filter(([name]) => name === 'content-type' || name.startsWith('x-')));
		forwardedHeaders['origin'] = productionOrigin;
		forwardedHeaders['referer'] = `${productionOrigin}/compatibility`;
		const sourceUrl = new URL(captured.url());
		const replay = await request.fetch(`${sourceUrl.pathname}${sourceUrl.search}`, {
			method: 'POST',
			headers: forwardedHeaders,
			data: captured.postData() ?? '',
		});

		const replayBody = await replay.text();
		// Solid's server-function transport returns a successful envelope even
		// when the invoked function throws. The payload is the security contract.
		expect(replay.status()).toBe(200);
		expect(replayBody).toContain('Not found.');
		expect(replayBody).not.toContain('must stay in the lab');
	} finally {
		await page.close();
	}
});
