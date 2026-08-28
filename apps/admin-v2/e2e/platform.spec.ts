import { expect, test } from '@playwright/test';

const disabledOrigin = 'http://127.0.0.1:43122';

test('renders the CSR shell without framework warnings', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto('/compatibility');
	await expect(page).toHaveTitle('YAH Admin');
	await expect(page.getByRole('heading', { name: 'Solid 2 platform smoke' })).toBeVisible();
	await expect(page.getByText('CSR', { exact: true })).toBeVisible();
	await expect(page.getByText('solid-router-2', { exact: true })).toBeVisible();
	expect(errors).toEqual([]);
});

test('shows the root loading fallback before the initial query settles', async ({ page }) => {
	let releaseQuery = () => {};
	const queryHeld = new Promise<void>((resolve) => {
		releaseQuery = resolve;
	});

	await page.route('**/_server**', async (route) => {
		if (route.request().method() === 'GET') await queryHeld;
		await route.continue();
	});
	await page.goto('/compatibility');
	await expect(page.getByText('Loading admin…')).toBeVisible();
	releaseQuery();
	await expect(page.getByRole('heading', { name: 'Solid 2 platform smoke' })).toBeVisible();
});

test('revalidates a failed route query before resetting its error boundary', async ({ page }) => {
	let queryAttempts = 0;
	await page.route('**/_server**', async (route) => {
		if (route.request().method() !== 'GET') {
			await route.continue();
			return;
		}

		queryAttempts += 1;
		if (queryAttempts === 1) {
			await route.abort('connectionfailed');
			return;
		}
		await route.continue();
	});

	await page.goto('/compatibility');
	await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByRole('heading', { name: 'Solid 2 platform smoke' })).toBeVisible();
	expect(queryAttempts).toBeGreaterThanOrEqual(2);
});

test('dispatches API methods through the built server', async ({ request }) => {
	const response = await request.get('/api/health');
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toContain('application/json');
	expect(await response.json()).toEqual({ app: 'yah-admin-v2', status: 'ok' });

	const head = await request.head('/api/health');
	expect(head.status()).toBe(200);
	expect(await head.body()).toHaveLength(0);
});

test('announces the non-enumerating password-reset result', async ({ page }) => {
	await page.goto('/forgot-password');
	await page.getByLabel('Email').fill('someone@example.test');
	await page.getByRole('button', { name: 'Send reset link' }).click();

	const result = page.getByRole('status');
	await expect(result).toContainText('If an account exists for someone@example.test');
	await expect(result).toHaveAttribute('aria-live', 'polite');
});

test('platform-disabled mode exposes health and rejects the unfinished application', async ({ playwright }) => {
	const disabled = await playwright.request.newContext({ baseURL: disabledOrigin });
	try {
		const health = await disabled.get('/api/health');
		expect(health.status()).toBe(200);
		expect(await health.json()).toEqual({ app: 'yah-admin-v2', status: 'ok' });

		for (const path of [
			'/',
			'/index.html',
			'/compatibility/auth',
			'/static-probe.txt',
			'/api/auth/get-session',
			'/api/adapter-probe',
			'/_server',
		]) {
			const response = await disabled.get(path);
			expect(response.status(), path).toBe(404);
		}

		const authPost = await disabled.post('/api/auth/sign-in/email', { data: {} });
		expect(authPost.status()).toBe(404);
	} finally {
		await disabled.dispose();
	}
});

test('srvx preserves Fetch response and static-file contracts', async ({ request }) => {
	const streamed = await request.get('/api/adapter-probe');
	expect(streamed.status()).toBe(200);
	expect(await streamed.text()).toBe('solid-adapter');
	expect(streamed.headersArray().filter(({ name }) => name.toLowerCase() === 'set-cookie')).toHaveLength(2);

	const posted = await request.post('/api/adapter-probe', { data: { value: 42 } });
	expect(await posted.json()).toEqual({ body: { value: 42 }, method: 'POST' });

	const staticFile = await request.get('/static-probe.txt');
	expect(staticFile.headers()['content-type']).toContain('text/plain');
	expect((await staticFile.text()).trim()).toBe('static-file-wins');
});

test('the server adapter flushes response chunks incrementally', async ({ page }) => {
	await page.goto('/compatibility');
	const chunks = await page.evaluate(async () => {
		const response = await fetch('/api/adapter-probe?stream=1');
		if (!response.body) throw new Error('Adapter probe did not return a response body');
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		const received: Array<{ at: number; text: string }> = [];

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			received.push({ at: performance.now(), text: decoder.decode(value) });
		}

		return received;
	});

	const combined = chunks.map(({ text }) => text).join('');
	expect(combined.startsWith('solid')).toBe(true);
	expect(combined.endsWith('-adapter')).toBe(true);
	expect(combined).toHaveLength(64 * 1024 + 'solid-adapter'.length);
	expect(chunks.length).toBeGreaterThanOrEqual(2);
	expect((chunks.at(-1)?.at ?? 0) - (chunks[0]?.at ?? 0)).toBeGreaterThanOrEqual(100);
});

test('submits a validated server-function mutation', async ({ page }) => {
	await page.goto('/compatibility');
	const responsePromise = page.waitForResponse(
		(response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/_server',
	);
	await page.getByLabel('Mutation label').fill(' reviewed platform ');
	await page.getByRole('button', { name: 'Run typed mutation' }).click();
	const response = await responsePromise;
	expect(response.status()).toBe(200);
	expect(response.request().headers()['x-single-flight']).toBeTruthy();
	expect(response.headers()['x-single-flight']).toBeTruthy();
	await expect(page.getByRole('status')).toHaveText('Accepted: reviewed platform');
});

test('surfaces a safe server validation failure', async ({ page }) => {
	await page.goto('/compatibility');
	await page.getByLabel('Mutation label').fill('   ');
	await page.getByRole('button', { name: 'Run typed mutation' }).click();
	await expect(page.getByRole('alert')).toHaveText('Mutation rejected by the server contract.');
	await expect(page.getByText('Valibot', { exact: false })).toHaveCount(0);
});

test('renders the client-side catch-all without a page error', async ({ page }) => {
	const pageErrors: string[] = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));

	await page.goto('/missing-platform-route');
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	expect(pageErrors).toEqual([]);
});

test('framework-neutral icon data renders accessible Solid 2 SVGs', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto('/compatibility/icons');
	const decorative = page.getByRole('list', { name: 'Navigation icons' }).locator('svg');
	await expect(decorative).toHaveCount(14);
	await expect(decorative.first()).toHaveAttribute('aria-hidden', 'true');
	await expect(decorative.first()).toHaveAttribute('focusable', 'false');
	await expect(decorative.first()).toHaveAttribute('viewBox', '0 0 24 24');
	await expect(decorative.first()).toHaveAttribute('stroke-width', '2');

	const labeled = page.getByRole('img', { name: 'Locked feature' });
	await expect(labeled).toHaveAttribute('width', '20');
	await expect(labeled).toHaveAttribute('stroke-width', '1.5');
	await expect(labeled).toHaveClass(/gallery-icon/);
	expect(errors).toEqual([]);
});

test('app-owned toast facade exposes accessible success, error, and dismissal states', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto('/compatibility/toasts');
	const notifications = page.getByRole('region', { name: 'Notifications' });
	await expect(notifications).not.toHaveAttribute('aria-live');
	const successTrigger = page.getByRole('button', { name: 'Show success' });
	await successTrigger.click();
	await expect(page.getByRole('status')).toContainText('Settings saved.');
	await page.getByRole('status').getByRole('button', { name: 'Dismiss success notification: Settings saved.' }).click();
	await expect(page.getByRole('status')).toHaveCount(0);
	await expect(successTrigger).toBeFocused();

	const errorTrigger = page.getByRole('button', { name: 'Show error' });
	await errorTrigger.click();
	await expect(page.getByRole('alert')).toContainText('Settings could not be saved.');
	const dismissError = page.getByRole('alert').getByRole('button', {
		name: 'Dismiss error notification: Settings could not be saved.',
	});
	await dismissError.focus();
	await expect(dismissError).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('alert')).toHaveCount(0);
	await expect(errorTrigger).toBeFocused();
	expect(errors).toEqual([]);
});

test('framework-neutral content engines preserve reactive lifecycle behavior', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto('/compatibility/content');
	const editor = page.getByRole('textbox', { name: 'Campaign content' });
	const output = page.getByLabel('Generated HTML');
	const toolbar = page.getByRole('toolbar', { name: 'Campaign content formatting' });
	for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Heading 1', 'Heading 2', 'Heading 3', 'Bulleted list', 'Numbered list', 'Block quote', 'Add link']) {
		await expect(toolbar.getByRole('button', { name })).toBeVisible();
	}
	await expect(editor).toContainText('Solid 2 keeps Lexical framework-neutral.');
	await expect(editor).not.toHaveAttribute('aria-busy');
	await editor.click();
	await page.keyboard.press('End');
	await page.keyboard.type(' Updated.');
	await expect(output).toContainText('Updated.');

	await editor.press('ControlOrMeta+A');
	await page.getByRole('button', { name: 'Bold' }).click();
	await expect(output).toContainText(/<(b|strong)/);
	await page.getByRole('button', { name: 'Add link' }).click();
	await page.getByLabel('Link URL').fill('https://example.org/campaign');
	await page.getByRole('button', { name: 'Apply link' }).click();
	await expect(output).toContainText(/<a href="https:\/\/example\.org\/campaign"/);

	await page.getByRole('button', { name: 'Replace editor value' }).click();
	await expect(editor).toHaveText('External replacement.');
	await page.getByRole('button', { name: 'Restore last editor change' }).click();
	await expect(editor).toContainText('Updated.');
	await page.getByRole('button', { name: 'Disable editor' }).click();
	await expect(editor).toHaveAttribute('aria-disabled', 'true');
	expect(await editor.evaluate((element) => (element as HTMLElement).isContentEditable)).toBe(false);
	await expect(page.getByRole('button', { name: 'Bold' })).toBeDisabled();

	const qr = page.getByRole('img', { name: 'QR preview' });
	await expect(qr.locator('svg')).toBeVisible();
	const initialQr = await qr.innerHTML();
	await page.getByLabel('QR destination').fill('');
	await expect(page.getByRole('alert')).toHaveText('Enter a QR destination.');
	await expect(page.getByRole('img', { name: 'QR preview' })).toHaveCount(0);
	await page.getByLabel('QR destination').fill('https://y4h.org/press');
	await expect(page.getByRole('img', { name: 'QR preview' })).toBeVisible();
	await expect.poll(() => qr.innerHTML()).not.toBe(initialQr);

	await page.goto('/compatibility');
	await expect(page.getByRole('heading', { name: 'Solid 2 platform smoke' })).toBeVisible();
	expect(errors).toEqual([]);
});

test('framework-neutral Better Auth client uses explicit Fetch handlers and session cookies', async ({ page, context }, testInfo) => {
	const errors: string[] = [];
	const email = `solid2-${testInfo.workerIndex}-${Date.now()}@example.test`;
	page.on('console', (message) => {
		if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto('/compatibility/auth');
	await page.getByLabel('Compatibility email').fill(email);
	await page.getByRole('button', { name: 'Load session' }).click();
	await expect(page.getByRole('status')).toHaveText('Signed out');

	await page.getByRole('button', { name: 'Create session' }).click();
	await expect(page.getByRole('status')).toHaveText(`Signed in as ${email}`);
	await expect.poll(async () => (await context.cookies()).some((cookie) => cookie.name === 'better-auth.session_token')).toBe(true);
	const sessionCookie = (await context.cookies()).find((cookie) => cookie.name === 'better-auth.session_token');
	expect(sessionCookie).toMatchObject({ httpOnly: true, path: '/', sameSite: 'Lax' });

	const session = await page.evaluate(async () => {
		const response = await fetch('/api/auth/get-session', { cache: 'no-store' });
		return { body: await response.json(), status: response.status };
	});
	expect(session.status).toBe(200);
	expect(session.body.user.email).toBe(email);

	for (const method of ['HEAD', 'OPTIONS', 'PUT', 'PATCH', 'DELETE', 'PROPFIND']) {
		const unsupportedResponse = await page.request.fetch('/api/auth/get-session', { method });
		expect(
			{
				allow: unsupportedResponse.headers()['allow'],
				contentType: unsupportedResponse.headers()['content-type'],
				status: unsupportedResponse.status(),
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
	expect((await context.cookies()).some((cookie) => cookie.name === 'better-auth.session_token')).toBe(true);

	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page.getByRole('status')).toHaveText('Signed out');
	await expect.poll(async () => (await context.cookies()).some((cookie) => cookie.name === 'better-auth.session_token')).toBe(false);
	expect(errors).toEqual([]);
});
