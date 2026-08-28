import {
	expect,
	test,
	bounceOnlyEmail,
	expectNoSeriousAccessibilityViolations,
	expectSelectedEmailSection,
	listOnlyEmail,
	ownerEmail,
	ownerPassword,
	subscriberOnlyEmail,
	upstreamOrigin,
} from '../production-test';

test('mailing lists preserve provider fields and expose only active public subscription sharing', async ({ page, request, context }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'Deterministic Listmonk assertions require the local fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${57 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await page.getByLabel('Primary navigation').getByRole('link', { name: 'Email' }).click();
	const emailNavigation = page.getByLabel('Email management');
	await expect(emailNavigation.getByRole('link', { name: 'Lists' })).toBeVisible();
	await expect(emailNavigation.getByRole('link', { name: 'Forms' })).toBeVisible();
	await emailNavigation.getByRole('link', { name: 'Lists' }).click();
	await expect(page.getByRole('heading', { name: 'Mailing lists' })).toBeVisible();
	await expect(page.getByRole('table', { name: 'Mailing lists' })).toBeVisible();
	await expectSelectedEmailSection(page, 'Lists');
	await expectNoSeriousAccessibilityViolations(page);

	await expect(page.getByRole('searchbox')).toHaveCount(0);
	await page.getByRole('link', { name: 'Campaign import 2026-08' }).click();
	await expectSelectedEmailSection(page, 'Lists');
	await expect(page.getByText('Temporary lists are provider-managed and read-only here.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
	await page.getByLabel('Breadcrumb').getByRole('link', { name: 'Mailing lists' }).click();

	await request.post(`${upstreamOrigin}/__control/fail-next?provider=listmonk`);
	await page.reload();
	await expect(page.getByRole('alert')).toContainText(/An unexpected error occurred\. Reference: [a-f0-9]{8}/);
	await expect(page.getByRole('alert')).not.toContainText('fixture confidential listmonk diagnostic');
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByRole('table', { name: 'Mailing lists' })).toBeVisible();

	await page.getByRole('link', { name: 'Volunteer coordination' }).click();
	await page.getByLabel(/Name/).fill('Stale local rename');
	const upstreamChange = await request.put(`${upstreamOrigin}/api/lists/12`, {
		headers: { authorization: 'token admin:fixture-listmonk-secret' },
		data: {
			name: 'Volunteer coordination upstream',
			type: 'private',
			optin: 'single',
			status: 'active',
			description: 'Upstream coordinator edit.',
			tags: ['volunteers', 'internal'],
		},
	});
	expect(upstreamChange.status()).toBe(200);
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByRole('alert')).toContainText('changed after you opened it');

	await page.reload();
	await expect(page.getByLabel(/Name/)).toHaveValue('Volunteer coordination upstream');
	await page.getByLabel('Description').fill('');
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByRole('alert')).toContainText('cannot clear an existing list description');
	await page.getByLabel(/Name/).fill('Volunteer updates');
	await page.getByLabel('Description').fill('Updated without discarding provider-owned tags.');
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Mailing list updated.' })).toBeVisible();

	const preserved = await request.get(`${upstreamOrigin}/api/lists/12`, {
		headers: { authorization: 'token admin:fixture-listmonk-secret' },
	});
	expect(preserved.status()).toBe(200);
	expect(((await preserved.json()) as { data: { tags: string[] } }).data.tags).toEqual(['volunteers', 'internal']);

	await emailNavigation.getByRole('link', { name: 'Forms' }).click();
	await expect(page.getByRole('heading', { name: 'Subscription forms' })).toBeVisible();
	const pressCard = page.getByRole('article').filter({ hasText: 'Press announcements' });
	await expect(pressCard).toContainText('Double opt-in');
	await expect(pressCard.locator('code')).toContainText('00000000-0000-4000-8000-000000000011');
	await expect(pressCard.locator('code')).toContainText('embed=1');
	await pressCard.getByRole('button', { name: 'Copy' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Embed code copied.' })).toBeVisible();

	const archivedRow = page.getByRole('row').filter({ hasText: 'Archived community bulletin' });
	await expect(archivedRow).toContainText('Reactivate from its list detail.');
	await expect(archivedRow.getByRole('button', { name: 'Publish' })).toHaveCount(0);
	const temporaryRow = page.getByRole('row').filter({ hasText: 'Campaign import 2026-08' });
	await expect(temporaryRow).toContainText('Provider-managed in Listmonk.');
	await expect(temporaryRow.getByRole('button', { name: 'Publish' })).toHaveCount(0);

	const volunteerRow = page.getByRole('row').filter({ hasText: 'Volunteer updates' });
	await volunteerRow.getByRole('button', { name: 'Publish' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Volunteer updates published.' })).toBeVisible();
	const volunteerCard = page.getByRole('article').filter({ hasText: 'Volunteer updates' });
	await expect(volunteerCard.locator('code')).toContainText('00000000-0000-4000-8000-000000000012');
	await expect(volunteerCard.locator('code')).toContainText('embed=1');
	await expectNoSeriousAccessibilityViolations(page);

	await emailNavigation.getByRole('link', { name: 'Lists' }).click();
	await page.getByRole('link', { name: 'New list' }).click();
	await expect(page.getByRole('heading', { name: 'New mailing list' })).toBeVisible();
	await expect(page.getByLabel('Visibility')).toHaveValue('private');
	await expect(page.getByLabel('Opt-in')).toHaveValue('double');
	await page.getByLabel(/Name/).fill('Phase review list');
	await page.getByLabel('Description').fill('Disposable browser contract.');
	await page.getByRole('button', { name: 'Create list' }).click();
	await expect(page).toHaveURL(/\/emails\/lists\/15$/);
	await expect(page.getByRole('heading', { name: 'Phase review list' })).toBeVisible();
	await expect(page.getByText('Private · Active · Double opt-in')).toBeVisible();

	const deleteButton = page.getByRole('button', {
		name: 'Delete',
		exact: true,
	});
	await deleteButton.click();
	const dialog = page.getByRole('dialog', { name: 'Delete mailing list?' });
	await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(deleteButton).toBeFocused();
	await deleteButton.click();
	await dialog.getByRole('button', { name: 'Delete list' }).click();
	await expect(page).toHaveURL(/\/emails\/lists$/);
	await expect(page.getByRole('link', { name: 'Phase review list' })).toHaveCount(0);
});

test('subscribers use bounded server pages and preserve provider-owned identity and consent state', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'Deterministic subscriber assertions require the local fixture.');
	test.setTimeout(90_000);
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${62 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await page.getByLabel('Primary navigation').getByRole('link', { name: 'Email' }).click();
	await page.getByLabel('Email management').getByRole('link', { name: 'Subscribers' }).click();
	await expect(page).toHaveURL(/\/emails\/subscribers$/);
	const table = page.getByRole('table', {
		name: 'Subscribers in fixed provider order',
	});
	await expect(table).toBeVisible();
	await expect(table.locator('tbody tr')).toHaveCount(50);
	await expect(table.locator('th button, [aria-sort]')).toHaveCount(0);
	await expect(page.getByText('Newest subscribers first')).toBeVisible();
	await expect(page.getByRole('button', { name: /filter|sort/i })).toHaveCount(0);

	await page.getByLabel('Select all actionable subscribers on this page').check();
	await expect(page.getByRole('status').filter({ hasText: '50 subscribers selected on this page' })).toBeVisible();
	await page.getByRole('link', { name: 'Next' }).click();
	await expect(page).toHaveURL(/\/emails\/subscribers\?page=2$/);
	await expect(table.locator('tbody tr')).toHaveCount(8);
	await expect(page.getByText(/selected on this page/)).toHaveCount(0);
	await page.goto('/emails/subscribers?page=999');
	await expect(page).toHaveURL(/\/emails\/subscribers\?page=2$/);
	await expect(table.locator('tbody tr')).toHaveCount(8);
	await page.getByRole('link', { name: 'Previous' }).click();

	const search = page.getByLabel('Search subscribers');
	await page.evaluate(() => {
		document.documentElement.dataset['subscriberDocument'] = 'preserved';
	});
	await search.fill('regex+literal@example.test');
	await page.getByRole('button', { name: 'Search' }).click();
	await expect(page).toHaveURL(/search=regex%2Bliteral%40example\.test/);
	await expect(page.locator('html')).toHaveAttribute('data-subscriber-document', 'preserved');
	await expect(table.locator('tbody tr')).toHaveCount(1);
	await expect(page.getByRole('link', { name: 'regex+literal@example.test' })).toBeVisible();
	await page.getByRole('link', { name: 'Clear' }).click();

	await search.fill('ada.supporter@example.test');
	await page.getByRole('button', { name: 'Search' }).click();
	await page.getByRole('link', { name: 'ada.supporter@example.test' }).click();
	await expect(page).toHaveURL(/\/emails\/subscribers\/158$/);
	await expect(page.getByRole('heading', { name: 'Ada Supporter' })).toBeVisible();
	await page.getByLabel('Name').fill('Stale local subscriber name');
	const touch = await request.post(`${upstreamOrigin}/__control/touch-subscriber?id=158`);
	expect(touch.ok()).toBe(true);
	await page.getByRole('button', { name: 'Save profile' }).click();
	await expect(page.getByRole('alert')).toContainText('changed after you opened it');

	await page.reload();
	await page.getByLabel('Name').fill('Ada Migration Review');
	await page.getByRole('button', { name: 'Save profile' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Subscriber profile updated.' })).toBeVisible();
	let subscriberState = await request.get(`${upstreamOrigin}/__control/subscribers`);
	expect(subscriberState.ok()).toBe(true);
	let providerSubscribers = (
		(await subscriberState.json()) as {
			subscribers: Array<Record<string, unknown>>;
			optInRequests: Array<Record<string, unknown>>;
		}
	).subscribers;
	let ada = providerSubscribers.find(({ id }) => id === 158);
	expect(ada).toMatchObject({
		name: 'Ada Migration Review',
		attribs: {
			source: 'community-event',
			preferences: { format: 'html', topics: ['press', 'volunteering'] },
			profile: { chapter: 'Austin', yearsActive: 3 },
		},
	});

	await page.getByLabel(/Volunteer coordination/).uncheck();
	await page.getByRole('button', { name: 'Save memberships' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Subscriber memberships updated.' })).toBeVisible();
	subscriberState = await request.get(`${upstreamOrigin}/__control/subscribers`);
	providerSubscribers = (
		(await subscriberState.json()) as {
			subscribers: Array<Record<string, unknown>>;
		}
	).subscribers;
	ada = providerSubscribers.find(({ id }) => id === 158);
	const adaMemberships = ada?.['lists'] as Array<Record<string, unknown>>;
	expect(adaMemberships.find(({ id }) => id === 12)).toMatchObject({
		subscription_status: 'unsubscribed',
		subscription_meta: { coordinator: 'Sam' },
	});
	await expect(
		page.getByRole('heading', {
			name: 'Provider- or consent-protected memberships',
		}),
	).toBeVisible();

	await request.post(`${upstreamOrigin}/__control/fail-next?provider=listmonk`);
	await page.getByRole('button', { name: 'Load activity' }).click();
	const activityError = page.getByRole('alert').filter({ hasText: 'Activity unavailable' });
	await expect(activityError).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Ada Migration Review' })).toBeVisible();
	await activityError.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByText('August supporter update', { exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'https://example.test/press' })).toBeVisible();
	await expectNoSeriousAccessibilityViolations(page);

	await page.getByLabel('Breadcrumb').getByRole('link', { name: 'Subscribers' }).click();
	await page.getByRole('link', { name: 'New subscriber' }).click();
	await page.getByRole('textbox', { name: /^Email/ }).fill('phase-review-subscriber@example.test');
	await page.getByLabel(/Name/).fill('Phase Review Subscriber');
	await page.getByLabel(/Press announcements/).check();
	await expect(page.getByLabel('Confirm selected memberships immediately')).not.toBeChecked();
	await page.getByRole('button', { name: 'Create subscriber' }).click();
	await expect(page).toHaveURL(/\/emails\/subscribers\/159$/);
	await expect(page.getByRole('button', { name: 'Request confirmation' })).toBeVisible();
	subscriberState = await request.get(`${upstreamOrigin}/__control/subscribers`);
	let createdState = (await subscriberState.json()) as {
		subscribers: Array<Record<string, unknown>>;
		optInRequests: Array<Record<string, unknown>>;
	};
	expect(createdState.optInRequests).not.toContainEqual(expect.objectContaining({ subscriberId: 159 }));
	expect(createdState.subscribers.find(({ id }) => id === 159)?.['lists']).toEqual([expect.objectContaining({ id: 11, subscription_status: 'unconfirmed' })]);
	await page.getByRole('button', { name: 'Request confirmation' }).click();
	const optInDialog = page.getByRole('dialog', {
		name: 'Request confirmation?',
	});
	await expect(optInDialog).toContainText('Acceptance does not prove that email delivery completed.');
	await optInDialog.getByRole('button', { name: 'Request confirmation' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Opt-in request accepted.' })).toBeVisible();
	subscriberState = await request.get(`${upstreamOrigin}/__control/subscribers`);
	createdState = (await subscriberState.json()) as {
		subscribers: Array<Record<string, unknown>>;
		optInRequests: Array<Record<string, unknown>>;
	};
	const finalState = createdState;
	expect(finalState.optInRequests).toContainEqual(expect.objectContaining({ subscriberId: 159 }));
	expect(finalState.subscribers.find(({ id }) => id === 159)?.['lists']).toEqual([expect.objectContaining({ id: 11, subscription_status: 'unconfirmed' })]);

	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await page.getByRole('dialog', { name: 'Delete subscriber?' }).getByRole('button', { name: 'Delete subscriber' }).click();
	await expect(page).toHaveURL(/\/emails\/subscribers$/);
	await expect(page.getByRole('link', { name: 'phase-review-subscriber@example.test' })).toHaveCount(0);
	await request.post(`${upstreamOrigin}/__control/reset`);
});

test('subscriber-only reads never serialize mailing-list or campaign metadata', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'The subscriber-only role is a local disposable fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${63 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(subscriberOnlyEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	const emailLink = page.getByLabel('Primary navigation').getByRole('link', { name: 'Email' });
	await expect(emailLink).toHaveAttribute('href', '/emails/subscribers');
	await emailLink.click();
	await expect(page.getByRole('table', { name: 'Subscribers in fixed provider order' })).toBeVisible();
	await expect(page.getByRole('columnheader', { name: 'Memberships' })).toHaveCount(0);

	const serverPayloads: string[] = [];
	page.on('response', async (response) => {
		if (!new URL(response.url()).pathname.startsWith('/_server')) return;
		serverPayloads.push(await response.text().catch(() => ''));
	});
	await page.goto('/emails/subscribers/158');
	await expect(page.getByRole('heading', { name: 'Ada Supporter' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Mailing-list memberships' })).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Send campaign test' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Load activity' })).toHaveCount(0);
	await expect(page.getByText('Press announcements', { exact: true })).toHaveCount(0);
	await expect(page.getByText('Volunteer coordination', { exact: true })).toHaveCount(0);
	await expect.poll(() => serverPayloads.length).toBeGreaterThan(0);
	const serialized = serverPayloads.join('\n');
	expect(serialized).not.toContain('Press announcements');
	expect(serialized).not.toContain('Volunteer coordination');
	expect(serialized).not.toContain('coordinator');
	await expectNoSeriousAccessibilityViolations(page);
});

test('bounces use bounded pages and confirmed global and subscriber-scoped clearing', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'Deterministic bounce assertions require the local fixture.');
	test.setTimeout(60_000);
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${66 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await page.getByLabel('Primary navigation').getByRole('link', { name: 'Email' }).click();
	await page.getByLabel('Email management').getByRole('link', { name: 'Bounces' }).click();
	const table = page.getByRole('table', {
		name: 'Bounce records in newest-first provider order',
	});
	await expect(table.locator('tbody tr')).toHaveCount(50);
	await expect(table.locator('th button, [aria-sort]')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /filter|sort/i })).toHaveCount(0);
	await expect(page.getByText('Page 1 of 2 · 53 total')).toBeVisible();
	await page.getByRole('link', { name: 'Next' }).click();
	await expect(page).toHaveURL(/\/emails\/bounces\?page=2$/);
	await expect(table.locator('tbody tr')).toHaveCount(3);
	await page.goto('/emails/bounces?page=999');
	await expect(page).toHaveURL(/\/emails\/bounces$/);
	await expect(table.locator('tbody tr')).toHaveCount(50);

	await table.locator('tbody tr').first().getByRole('checkbox').check();
	await page.getByRole('button', { name: 'Clear selected' }).click();
	const selectedDialog = page.getByRole('dialog', {
		name: 'Clear selected bounce records?',
	});
	await selectedDialog.getByRole('button', { name: 'Clear bounce records' }).click();
	await expect(page.getByRole('status').filter({ hasText: '1 bounce record cleared.' })).toBeVisible();
	await expect.poll(async () => (await (await request.get(`${upstreamOrigin}/__control/bounces`)).json()).bounces.length).toBe(52);

	await page.goto('/emails/subscribers/158');
	await expect(page.getByRole('heading', { name: 'Ada Supporter' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Save memberships' })).toBeVisible();
	await request.post(`${upstreamOrigin}/__control/fail-next?provider=listmonk`);
	await page.getByRole('button', { name: 'Load bounce history' }).click();
	const bounceError = page.getByRole('alert').filter({ hasText: 'Bounce history unavailable' });
	await expect(bounceError).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Ada Supporter' })).toBeVisible();
	await bounceError.getByRole('button', { name: 'Try again' }).click();
	const subscriberTable = page.getByRole('table', {
		name: 'Bounce history for ada.supporter@example.test',
	});
	await expect(subscriberTable.locator('tbody tr')).toHaveCount(1);
	await page.getByRole('button', { name: 'Clear subscriber bounce history' }).click();
	const subscriberDialog = page.getByRole('dialog', {
		name: 'Clear subscriber bounce history?',
	});
	await subscriberDialog.getByRole('button', { name: 'Clear bounce history' }).click();
	await expect(subscriberTable.getByText('No bounce records for this subscriber.')).toBeVisible();
	await expect
		.poll(
			async () =>
				(await (await request.get(`${upstreamOrigin}/__control/bounces`)).json()).bounces.filter((bounce: { subscriber_id: number }) => bounce.subscriber_id === 158).length,
		)
		.toBe(0);

	await page.goto('/emails/bounces');
	await page.getByRole('button', { name: 'Clear all bounce records' }).click();
	const allDialog = page.getByRole('dialog', {
		name: 'Clear all bounce records?',
	});
	await allDialog.getByRole('button', { name: 'Clear all bounce records' }).click();
	await expect(table.getByText('No bounce records are available.')).toBeVisible();
	await expect.poll(async () => (await (await request.get(`${upstreamOrigin}/__control/bounces`)).json()).bounces.length).toBe(0);
	await expectNoSeriousAccessibilityViolations(page);
	await request.post(`${upstreamOrigin}/__control/reset`);
});

test('a bounce-view-only role lands on bounded bounce history without clear controls', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'The bounce-only role is a local disposable fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${65 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(bounceOnlyEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	const emailLink = page.getByLabel('Primary navigation').getByRole('link', { name: 'Email' });
	await expect(emailLink).toHaveAttribute('href', '/emails/bounces');
	const serverPayloads: string[] = [];
	page.on('response', async (response) => {
		if (!new URL(response.url()).pathname.startsWith('/_server')) return;
		serverPayloads.push(await response.text().catch(() => ''));
	});
	await emailLink.click();
	await expect(page).toHaveURL(/\/emails\/bounces$/);
	const emailNavigation = page.getByLabel('Email management');
	await expect(emailNavigation.getByRole('link', { name: 'Bounces' })).toBeVisible();
	for (const link of ['Campaigns', 'Email analytics', 'Templates', 'Lists', 'Forms', 'Subscribers']) {
		await expect(emailNavigation.getByRole('link', { name: link })).toHaveCount(0);
	}
	const table = page.getByRole('table', {
		name: 'Bounce records in newest-first provider order',
	});
	await expect(table.locator('tbody tr')).toHaveCount(50);
	await expect(table.getByRole('checkbox').first()).toBeDisabled();
	await expect(page.getByRole('button', { name: /clear all bounce records/i })).toHaveCount(0);
	await expect.poll(() => serverPayloads.length).toBeGreaterThan(0);
	const serialized = serverPayloads.join('\n');
	expect(serialized).toContain('August supporter update');
	expect(serialized).not.toContain('subscriberStatus');
	expect(serialized).not.toContain('subscriberId');
	expect(serialized).not.toContain('10000000-0000-4000-8000-');
	await expectNoSeriousAccessibilityViolations(page);
});

test('a mailing-list-only role lands on its first authorized email route', async ({ page }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'The list-only role is a local disposable fixture.');
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${59 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(listOnlyEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

	const emailLink = page.getByLabel('Primary navigation').getByRole('link', { name: 'Email' });
	await expect(emailLink).toHaveAttribute('href', '/emails/lists');
	await emailLink.click();
	await expect(page).toHaveURL(/\/emails\/lists$/);
	await expect(page.getByRole('heading', { name: 'Mailing lists' })).toBeVisible();
	await expect(page.getByRole('table', { name: 'Mailing lists' })).toBeVisible();
	await expect(page.getByLabel('Email management').getByRole('link', { name: 'Templates' })).toHaveCount(0);
	await expect(page.getByLabel('Email management').getByRole('link', { name: 'Lists' })).toBeVisible();
	await expect(page.getByLabel('Email management').getByRole('link', { name: 'Forms' })).toBeVisible();
});
