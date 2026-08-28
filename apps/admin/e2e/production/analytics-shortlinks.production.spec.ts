import { expect, test, ownerEmail, ownerPassword, softNavigate, upstreamOrigin } from '../production-test';

test('analytics is permission-discoverable, keyboard-selectable, semantic, and safely retryable', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_PRODUCTION_E2E_BASE_URL'], 'Deterministic analytics assertions require the local fixture.');
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${30 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	const analyticsLink = page.getByRole('link', { name: 'Analytics' });
	await expect(analyticsLink).toBeVisible();
	await analyticsLink.click();
	await expect(page).toHaveURL(/\/analytics$/);
	await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
	await expect(page.getByRole('group', { name: 'Reporting period' })).toBeVisible();

	const pageviewStat = page.locator('.analytics-stat').filter({ hasText: 'Pageviews' }).locator('dd');
	await expect(page.getByLabel('7d')).toBeChecked();
	await expect(pageviewStat).toHaveText('700');
	await expect(page.getByRole('figure', { name: /Pageviews over the last 7 days/ })).toBeVisible();
	for (const caption of ['Top Pages', 'Referrers', 'Browsers', 'Operating Systems', 'Devices']) {
		await expect(page.getByRole('table', { name: caption })).toBeVisible();
	}
	await expect(page.getByRole('columnheader', { name: 'Visitors' })).toHaveCount(5);

	await request.post(`${upstreamOrigin}/__control/delay-next`);
	await page.getByLabel('7d').focus();
	await page.keyboard.press('ArrowLeft');
	await expect(page.getByLabel('24h')).toBeChecked();
	await expect(page.getByText('Loading analytics…')).toBeHidden();
	await expect(page.getByRole('status').filter({ hasText: 'Updating analytics…' })).toHaveClass(/visually-hidden/);
	await expect(pageviewStat).toHaveText('700');
	await expect(pageviewStat).toHaveText('100');
	await page.keyboard.press('ArrowLeft');
	await expect(page.getByLabel('30d')).toBeChecked();
	await expect(pageviewStat).toHaveText('3,000');

	const control = await request.post(`${upstreamOrigin}/__control/fail-next`);
	expect(control.ok()).toBe(true);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
	await expect(page.getByRole('group', { name: 'Reporting period' })).toBeVisible();
	await expect(page.getByRole('alert')).toContainText('Analytics for this period could not be loaded.');
	await expect(page.getByRole('alert')).not.toContainText('fixture confidential diagnostic');
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
	await expect(pageviewStat).toHaveText('700');
});

test('shortlinks preserve the typed CRUD workflow and dashboard panels fail independently', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_PRODUCTION_E2E_BASE_URL'], 'Deterministic Shlink assertions require the local fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${50 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Recent shortlinks' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Site analytics' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'press-kit' })).toBeVisible();
	await expect(page.locator('.dashboard-stats').first().locator('dd')).toHaveText(['2', '2', '1', '1']);

	await page.getByLabel('Primary navigation').getByRole('link', { name: 'Shortlinks' }).click();
	await expect(page).toHaveURL(/\/shortlinks$/);
	const shortlinksTable = page.getByRole('table', { name: 'Shortlinks' });
	await expect(shortlinksTable).toBeVisible();
	await expect(shortlinksTable.getByRole('columnheader')).toHaveText(['Short URL', 'Destination', 'Tags', 'Clicks', 'Created']);
	await expect(shortlinksTable.getByRole('row').nth(1).getByRole('link', { name: 'press-kit' })).toBeVisible();
	await expect(shortlinksTable.getByRole('row').nth(2).getByRole('link', { name: 'about' })).toBeVisible();
	await expect(shortlinksTable.locator('th button, [aria-sort]')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'press-kit' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'about' })).toBeVisible();

	await page.getByRole('link', { name: 'press-kit' }).click();
	await expect(page).toHaveURL(/\/shortlinks\/~h70726573732d6b6974\/details$/);
	await expect(page.locator('.shortlink-stats dd')).toHaveText(['2', '1', '1']);
	await expect(page.getByText('Fixture Browser')).toBeVisible();
	await expect(page.getByText('Fixture Bot')).toHaveCount(0);

	// Router next.17 reuses a component when only a dynamic parameter changes.
	// The keyed route owner must discard press-kit's dialog and edit draft state.
	await page.getByRole('button', { name: 'Reset visits' }).click();
	await expect(page.getByRole('dialog', { name: 'Reset visit history?' })).toBeVisible();
	await softNavigate(page, '/shortlinks/~h61626f7574/details');
	await expect(page).toHaveURL(/\/shortlinks\/~h61626f7574\/details$/);
	await expect(page.getByRole('heading', { name: 'About YAH' })).toBeVisible();
	await expect(page.getByRole('dialog', { name: 'Reset visit history?' })).toHaveCount(0);
	await page.getByRole('link', { name: 'Edit' }).click();
	await page.getByLabel(/Destination URL/).fill('https://stale-draft.example.test/');
	await softNavigate(page, '/shortlinks/~h70726573732d6b6974/edit');
	await expect(page.getByRole('heading', { name: 'Edit press-kit' })).toBeVisible();
	await expect(page.getByLabel(/Destination URL/)).toHaveValue('https://example.test/press');
	await softNavigate(page, '/shortlinks/~h70726573732d6b6974/details');
	await expect(page.locator('.shortlink-stats dd')).toHaveText(['2', '1', '1']);

	await page.getByRole('button', { name: 'Reset visits' }).click();
	await page.getByRole('dialog', { name: 'Reset visit history?' }).getByRole('button', { name: 'Reset visits' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Deleted 2 visits.' })).toBeVisible();
	await expect(page.locator('.shortlink-stats dd')).toHaveText(['0', '0', '0']);
	await expect(page.getByText('No visits yet.')).toBeVisible();
	await page.getByLabel('Breadcrumb').getByRole('link', { name: 'Shortlinks' }).click();

	await page.getByRole('link', { name: 'New shortlink' }).click();
	await expect(page.getByLabel('Forward query parameters')).toBeChecked();
	await expect(page.getByLabel('Allow search engine crawling')).not.toBeChecked();
	await page.getByLabel(/Destination URL/).fill('https://example.test/review-one');
	await page.getByLabel(/Custom short code/).fill('press-kit');
	await page.getByRole('button', { name: 'Create shortlink' }).click();
	await expect(page.getByRole('alert')).toHaveText('That short code is already in use.');

	await page.getByLabel(/Custom short code/).fill('review-link');
	await page.getByLabel(/Title/).fill('Review link');
	await page.getByLabel(/Tags/).fill('review, migration, review');
	await page.getByLabel(/Maximum visits/).fill('25');
	await page.getByLabel(/Expires/).fill('2026-12-31T12:00');
	await page.getByLabel('Allow search engine crawling').check();
	await page.getByRole('button', { name: 'Create shortlink' }).click();
	await expect(page).toHaveURL(/\/shortlinks\/~h7265766965772d6c696e6b\/details$/);
	await expect(page.getByRole('heading', { name: 'Review link' })).toBeVisible();
	const qrPreview = page.getByRole('img', { name: 'QR code for review-link' });
	const qrControls = page.getByRole('group', { name: 'QR code appearance' });
	await expect(qrPreview).toBeVisible();
	const qrPreviewBox = await qrPreview.boundingBox();
	const qrControlsBox = await qrControls.boundingBox();
	expect(qrPreviewBox).not.toBeNull();
	expect(qrControlsBox).not.toBeNull();
	expect(qrPreviewBox!.width).toBeGreaterThanOrEqual(200);
	expect(qrPreviewBox!.y + qrPreviewBox!.height).toBeLessThanOrEqual(qrControlsBox!.y);
	await page.getByLabel('Dots').selectOption({ label: 'Dots' });
	await page.getByLabel('Corners').selectOption({ label: 'Square' });
	await page.getByLabel('Include logo').check();
	await page.getByRole('button', { name: 'Inverted' }).click();
	await expect
		.poll(async () =>
			page
				.getByRole('img', { name: 'QR code for review-link' })
				.locator('svg')
				.evaluate((svg) => svg.outerHTML),
		)
		.toContain('#262637');
	const svgDownloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download SVG' }).click();
	const svgDownload = await svgDownloadPromise;
	expect(svgDownload.suggestedFilename()).toBe('qr-review-link.svg');
	const svgStream = await svgDownload.createReadStream();
	let svgContents = '';
	for await (const chunk of svgStream) svgContents += chunk.toString();
	expect(svgContents).toContain('#fff7ef');
	expect(svgContents).toContain('#262637');
	const pngDownloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download PNG' }).click();
	expect((await pngDownloadPromise).suggestedFilename()).toBe('qr-review-link.png');
	await expect(page.getByText('25', { exact: true })).toBeVisible();
	await expect(page.getByText('review', { exact: true })).toHaveCount(1);

	await page.getByRole('link', { name: 'Edit' }).click();
	await expect(page.getByRole('heading', { name: 'Edit review-link' })).toBeVisible();
	const unusedFormSpace = await page.locator('.shortlink-form').evaluate((form) => {
		const parent = form.parentElement!;
		const parentStyle = getComputedStyle(parent);
		const contentRight = parent.getBoundingClientRect().right - Number.parseFloat(parentStyle.paddingRight);
		return contentRight - form.getBoundingClientRect().right;
	});
	expect(Math.abs(unusedFormSpace)).toBeLessThan(2);
	await expect(page.getByLabel(/Custom short code/)).toHaveCount(0);
	const destinationWidth = await page.getByLabel(/Destination URL/).evaluate((input) => input.getBoundingClientRect().width);
	const titleWidth = await page.getByLabel(/Title/).evaluate((input) => input.getBoundingClientRect().width);
	expect(Math.abs(destinationWidth - titleWidth)).toBeLessThan(2);
	await expect(page.getByLabel(/Expires/)).toHaveValue('2026-12-31T12:00');
	await page.getByLabel(/Destination URL/).fill('https://example.test/review-two');
	await page.getByLabel(/Title/).fill('Updated review link');
	await page.getByLabel(/Maximum visits/).fill('');
	await page.getByLabel(/Expires/).fill('');
	await page.getByLabel('Forward query parameters').uncheck();
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page).toHaveURL(/\/shortlinks\/~h7265766965772d6c696e6b\/details$/);
	await expect(page.getByRole('heading', { name: 'Updated review link' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'https://example.test/review-two' })).toBeVisible();
	await expect(page.getByText('Unlimited')).toBeVisible();
	await expect(page.getByText('Never')).toBeVisible();

	const resetButton = page.getByRole('button', { name: 'Reset visits' });
	await resetButton.click();
	await expect(page.getByRole('dialog', { name: 'Reset visit history?' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(resetButton).toBeFocused();

	const deleteButton = page.getByRole('button', {
		name: 'Delete',
		exact: true,
	});
	await deleteButton.click();
	await page.getByRole('dialog', { name: 'Delete shortlink?' }).getByRole('button', { name: 'Delete shortlink' }).click();
	await expect(page).toHaveURL(/\/shortlinks$/);
	await expect(page.getByRole('link', { name: 'review-link' })).toHaveCount(0);

	await page.getByRole('link', { name: 'New shortlink' }).click();
	await page.getByLabel(/Destination URL/).fill('https://example.test/signup');
	await page.getByLabel(/Custom short code/).fill('signup');
	await page.getByRole('button', { name: 'Create shortlink' }).click();
	await expect(page.getByText('This permanent short URL is printed in QR materials.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);

	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Recent shortlinks' })).toBeVisible();
	await request.post(`${upstreamOrigin}/__control/fail-next?provider=shlink`);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Shortlinks unavailable' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Site analytics' })).toBeVisible();
	await expect(page.getByRole('alert')).not.toContainText('fixture confidential shlink diagnostic');
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByRole('heading', { name: 'Recent shortlinks' })).toBeVisible();

	await request.post(`${upstreamOrigin}/__control/fail-next`);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Site analytics unavailable' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Recent shortlinks' })).toBeVisible();
	await expect(page.getByRole('alert')).not.toContainText('fixture confidential diagnostic');
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByRole('heading', { name: 'Site analytics' })).toBeVisible();
});
