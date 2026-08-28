import {
	expect,
	test,
	expectNoDocumentOverflow,
	expectSelectedEmailSection,
	expectSelectedPrimarySection,
	ownerEmail,
	ownerPassword,
} from '../production-test';

test('production serves only its completed routes and public assets', async ({ request }) => {
	const health = await request.get('/api/health');
	expect(health.status()).toBe(200);
	expect(await health.json()).toEqual({ app: 'yah-admin', runtime: 'production', status: 'ok' });

	const logo = await request.get('/logo.svg');
	expect(logo.status()).toBe(200);
	expect(logo.headers()['content-type']).toContain('image/svg+xml');

	// `/static-probe.txt` is a real file under `static/`; it must stay unreachable
	// because production mounts no static middleware for it.
	for (const path of ['/index.html', '/static-probe.txt', '/not-a-product-page', '/api/not-an-endpoint']) {
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

	// The reset request must answer identically whether or not the mailbox
	// exists, so the response cannot be used to enumerate accounts.
	await page.goto('/forgot-password');
	await page.getByLabel('Email').fill('someone@example.test');
	await page.getByRole('button', { name: 'Send reset link' }).click();
	const result = page.getByRole('status');
	await expect(result).toContainText('If an account exists for someone@example.test');
	await expect(result).toHaveAttribute('aria-live', 'polite');
});

test('the auth API accepts only GET and POST and rejects untrusted origins', async ({ page }) => {
	for (const method of ['HEAD', 'OPTIONS', 'PUT', 'PATCH', 'DELETE', 'PROPFIND']) {
		const unsupported = await page.request.fetch('/api/auth/get-session', { method });
		expect(
			{
				allow: unsupported.headers()['allow'],
				contentType: unsupported.headers()['content-type'],
				status: unsupported.status(),
			},
			method,
		).toEqual({ allow: 'GET, POST', contentType: undefined, status: 405 });
	}

	for (const origin of ['https://attacker.example', 'null']) {
		const rejected = await page.request.post('/api/auth/sign-out', { data: {}, headers: { origin } });
		expect(rejected.status(), origin).toBe(403);
		expect(rejected.headers()['content-type'], origin).not.toContain('text/html');
	}

	const missingOrigin = await page.request.post('/api/auth/sign-out', { data: {} });
	expect(missingOrigin.status()).toBe(403);
	expect(missingOrigin.headers()['content-type']).not.toContain('text/html');
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

test('an unknown server-function id cannot be invoked and leaks no internals', async ({ request }) => {
	const payload = 'must-not-be-echoed-back';
	const replay = await request.fetch('/_server', {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'x-server-id': 'src/not-a-real-module.ts#notARealServerFunction' },
		data: JSON.stringify([payload]),
	});

	// Solid's transport answers with an envelope rather than a transport-level
	// error, so the body is the security contract, not the status code.
	const body = await replay.text();
	expect(body).not.toContain(payload);
	for (const leak of ['Valibot', 'DATABASE_URL', 'node_modules', 'at Object.', '/home/']) {
		expect(body, leak).not.toContain(leak);
	}
});

test('the root loading boundary covers the first query before the dashboard resolves', async ({ page }, testInfo) => {
	await page.setExtraHTTPHeaders({ 'x-forwarded-for': `127.0.0.${70 + testInfo.retry}` });
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

	let releaseQuery = () => {};
	const queryHeld = new Promise<void>((resolve) => {
		releaseQuery = resolve;
	});
	await page.route('**/_server**', async (route) => {
		if (route.request().method() === 'GET') await queryHeld;
		await route.continue();
	});

	await page.goto('/');
	await expect(page.getByText('Loading admin…')).toBeVisible();
	releaseQuery();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('client-side navigation to an unrouted path renders the catch-all without a page error', async ({ page }, testInfo) => {
	const pageErrors: string[] = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));

	await page.setExtraHTTPHeaders({ 'x-forwarded-for': `127.0.0.${80 + testInfo.retry}` });
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

	// A direct load of this path is refused by the HTTP allowlist before the
	// client ever runs, so the catch-all route is only reachable in production
	// through in-app navigation.
	await page.evaluate(() => {
		history.pushState({}, '', '/not-a-product-page');
		dispatchEvent(new PopStateEvent('popstate'));
	});

	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	expect(pageErrors).toEqual([]);
});
