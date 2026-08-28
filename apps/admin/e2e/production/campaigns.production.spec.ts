import {
	expect,
	test,
	campaignOnlyEmail,
	expectNoSeriousAccessibilityViolations,
	expectSelectedEmailSection,
	ownerEmail,
	ownerPassword,
	splitTestSendEmail,
	upstreamOrigin,
} from '../production-test';

test('campaigns preserve provider state, enforce stale versions, and use truthful status and opt-in workflows', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'Deterministic campaign assertions require the local fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${58 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await page.getByLabel('Primary navigation').getByRole('link', { name: 'Email' }).click();
	const emailNavigation = page.getByLabel('Email management');
	await emailNavigation.getByRole('link', { name: 'Campaigns' }).click();
	await expect(page).toHaveURL(/\/emails\/campaigns$/);
	await expectSelectedEmailSection(page, 'Campaigns');
	const table = page.getByRole('table', {
		name: 'Campaigns, delivery status, target lists, and progress',
	});
	await expect(table).toBeVisible();
	await expect(page.getByRole('link', { name: 'August supporter update' })).toBeVisible();
	await expect(page.getByRole('columnheader', { name: 'Updated' })).toBeVisible();
	await expect(table.locator('th button, [aria-sort]')).toHaveCount(0);
	await expect(page.getByRole('searchbox')).toHaveCount(0);
	await expectNoSeriousAccessibilityViolations(page);

	await page.getByRole('link', { name: 'August supporter update' }).click();
	await expect(page.getByRole('heading', { name: 'August supporter update' })).toBeVisible();
	await expectSelectedEmailSection(page, 'Campaigns');
	await expect(page.getByLabel('Campaign template').locator('option')).toHaveText(['Default campaign template', 'Default campaign']);
	await expect(page.getByLabel('Campaign template').locator('option', { hasText: 'Visual newsletter' })).toHaveCount(0);
	await expect(page.getByRole('group', { name: /Mailing lists/ }).getByLabel(/Archived community bulletin/)).toHaveCount(0);
	await page.getByLabel(/Name/).fill('Stale local campaign name');
	const touch = await request.post(`${upstreamOrigin}/__control/touch-campaign?id=21`);
	expect(touch.ok()).toBe(true);
	await page.getByRole('button', { name: 'Save draft' }).click();
	await expect(page.getByRole('alert')).toContainText('changed after you opened it');

	await page.reload();
	await page.getByRole('button', { name: 'Preview saved campaign' }).click();
	await expect(page.getByTitle('Rendered saved campaign preview').contentFrame().getByText('Fixture campaign body')).toBeVisible();
	await page.getByLabel(/Name/).fill('August migration review');
	await page.getByLabel('Tags').fill('monthly, migration, monthly');
	const campaignToolbar = page.getByRole('toolbar', {
		name: 'Campaign content formatting',
	});
	for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Heading 1', 'Heading 2', 'Heading 3', 'Bulleted list', 'Numbered list', 'Block quote', 'Add link']) {
		await expect(campaignToolbar.getByRole('button', { name })).toBeVisible();
	}
	await page.getByRole('textbox', { name: 'Campaign content' }).fill('Updated fixture campaign content');
	await page.getByRole('button', { name: 'Save draft' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Campaign draft updated.' })).toBeVisible();
	await expect(page.getByTitle('Rendered saved campaign preview')).toHaveCount(0);

	const providerState = await request.get(`${upstreamOrigin}/__control/campaigns`);
	expect(providerState.ok()).toBe(true);
	const providerCampaigns = (
		(await providerState.json()) as {
			campaigns: Array<Record<string, unknown>>;
		}
	).campaigns;
	const updated = providerCampaigns.find(({ id }) => id === 21);
	expect(updated).toMatchObject({
		name: 'August migration review',
		headers: [{ 'x-provider-owned': 'preserve-me' }],
		attribs: { providerOwned: true },
		archive_meta: { providerOwned: true },
		tags: ['monthly', 'migration'],
	});

	await page.getByRole('button', { name: 'Preview saved campaign' }).click();
	const preview = page.getByTitle('Rendered saved campaign preview');
	await expect(preview).toHaveAttribute('sandbox', '');
	await expect(preview).toHaveAttribute('referrerpolicy', 'no-referrer');
	await expect(preview.contentFrame().getByText('Updated fixture campaign content')).toBeVisible();
	await expectNoSeriousAccessibilityViolations(page, ['iframe[title="Rendered saved campaign preview"]']);

	await page.getByLabel('Scheduled time').fill('2099-01-02T03:04');
	await page.getByRole('button', { name: 'Save draft' }).click();
	await expect(page.getByRole('button', { name: 'Schedule' })).toBeVisible();
	await page.getByRole('button', { name: 'Schedule' }).click();
	await page.getByRole('dialog', { name: 'Schedule campaign?' }).getByRole('button', { name: 'Schedule campaign' }).click();
	await expect(page.locator('.campaign-status').filter({ hasText: /^Scheduled$/ })).toBeVisible();
	await page.getByRole('button', { name: 'Return to draft' }).click();
	await page.getByRole('dialog', { name: 'Return campaign to draft?' }).getByRole('button', { name: 'Return to draft' }).click();
	await expect(page.getByRole('button', { name: 'Schedule' })).toBeVisible();
	await page.getByLabel('Scheduled time').fill('');
	await page.getByRole('button', { name: 'Save draft' }).click();
	await expect(page.getByRole('button', { name: 'Send now' })).toBeVisible();

	await page.getByRole('button', { name: 'Send now' }).click();
	const sendDialog = page.getByRole('dialog', { name: 'Send campaign now?' });
	await expect(sendDialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
	await sendDialog.getByRole('button', { name: 'Send now' }).click();
	await page.getByRole('button', { name: 'Pause' }).click();
	await page.getByRole('dialog', { name: 'Pause campaign?' }).getByRole('button', { name: 'Pause campaign' }).click();
	await page.getByRole('button', { name: 'Resume' }).click();
	await page.getByRole('dialog', { name: 'Resume campaign?' }).getByRole('button', { name: 'Resume campaign' }).click();
	await page.getByRole('button', { name: 'Pause' }).click();
	await page.getByRole('dialog', { name: 'Pause campaign?' }).getByRole('button', { name: 'Pause campaign' }).click();
	await page.locator('.campaign-detail-actions').getByRole('button', { name: 'Cancel' }).click();
	await page.getByRole('dialog', { name: 'Cancel campaign?' }).getByRole('button', { name: 'Cancel campaign' }).click();
	await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();

	await emailNavigation.getByRole('link', { name: 'Campaigns' }).click();
	await page.getByRole('link', { name: 'New campaign' }).click();
	await page.getByLabel('Confirmation campaign').check();
	await expect(page.getByRole('group', { name: /Mailing lists/ }).getByLabel(/Press announcements/)).toBeVisible();
	await expect(page.getByRole('group', { name: /Mailing lists/ }).getByLabel(/Volunteer coordination/)).toHaveCount(0);
	await page.getByLabel(/Name/).fill('Press confirmation resend');
	await page.getByLabel(/Subject/).fill('Please confirm press announcements');
	await page.getByLabel(/Press announcements/).check();
	await page.getByRole('button', { name: 'Create draft' }).click();
	await expect(page).toHaveURL(/\/emails\/campaigns\/22$/);
	await expect(page.getByText(/Listmonk generates and owns the confirmation message/)).toBeVisible();
	const optinState = await request.get(`${upstreamOrigin}/__control/campaigns`);
	const optinCampaign = ((await optinState.json()) as { campaigns: Array<Record<string, unknown>> }).campaigns.find(({ id }) => id === 22);
	expect(optinCampaign).toMatchObject({
		type: 'optin',
		lists: [{ id: 11, name: 'Press announcements' }],
	});
	expect(String(optinCampaign?.['body'])).toContain('OptinURL');

	await page.getByLabel('Breadcrumb').getByRole('link', { name: 'Campaigns' }).click();
	await page.getByRole('link', { name: 'New campaign' }).click();
	await page.getByLabel('Confirmation campaign').check();
	await page.getByLabel(/Name/).fill('Press confirmation companion');
	await page.getByLabel(/Subject/).fill('Please confirm the companion campaign');
	await page.getByLabel(/Press announcements/).check();
	await page.getByRole('button', { name: 'Create draft' }).click();
	await expect(page).toHaveURL(/\/emails\/campaigns\/23$/);
	await page.getByLabel('Breadcrumb').getByRole('link', { name: 'Campaigns' }).click();
	await page.getByLabel('Select up to 100 draft campaigns').check();
	await expect(page.getByRole('status').filter({ hasText: '2 draft campaigns selected' })).toBeVisible();
	await page.getByRole('button', { name: 'Delete selected' }).click();
	const deleteDialog = page.getByRole('dialog', {
		name: 'Delete selected draft campaigns?',
	});
	await expect(deleteDialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
	await deleteDialog.getByRole('button', { name: 'Delete campaigns' }).click();
	await expect(page.getByRole('link', { name: 'Press confirmation resend' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Press confirmation companion' })).toHaveCount(0);
	await request.post(`${upstreamOrigin}/__control/reset`);
});

test('email analytics uses URL-owned native filters and one provider request per metric', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'Deterministic campaign analytics assertions require the local fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${67 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await page.getByLabel('Primary navigation').getByRole('link', { name: 'Email' }).click();
	await page.getByLabel('Email management').getByRole('link', { name: 'Email analytics' }).click();
	await expect(page).toHaveURL(/\/emails\/analytics$/);
	await expect(page.getByRole('heading', { name: 'Campaign analytics' })).toBeVisible();
	await expect(page.getByText('Select at least one campaign to view email analytics.')).toBeVisible();
	await expect(page.getByRole('button', { name: /filter|sort/i })).toHaveCount(0);

	await page.getByLabel(/August supporter update/).check();
	await page.getByLabel('From').fill('2026-08-23');
	await page.getByLabel('To').fill('2026-08-24');
	await page.locator('html').evaluate((element) => {
		element.dataset['analyticsDocument'] = 'preserved';
	});
	await page.getByRole('button', { name: 'Apply' }).click();
	await expect(page).toHaveURL(/\/emails\/analytics\?campaign=21&from=2026-08-23&to=2026-08-24$/);
	await expect(page.locator('html')).toHaveAttribute('data-analytics-document', 'preserved');
	await expect(page.getByRole('heading', { name: 'Email views' })).toBeVisible();
	await expect(page.getByText('25 total views')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Link clicks' })).toBeVisible();
	await expect(page.getByText('7 total clicks')).toBeVisible();
	await expect(page.locator('.campaign-metric-figure li')).toHaveCount(6);
	await expect(page.getByText('Aug 23, 2026, 1:00 AM UTC')).toHaveCount(2);
	await expect(page.getByText('Aug 23, 2026, 2:00 PM UTC')).toHaveCount(2);

	const control = await request.get(`${upstreamOrigin}/__control/campaign-analytics`);
	expect(control.ok()).toBe(true);
	const analyticsRequests = (
		(await control.json()) as {
			requests: Array<{
				metric: string;
				campaignIds: number[];
				from: string;
				to: string;
			}>;
		}
	).requests;
	expect(analyticsRequests).toHaveLength(2);
	expect(analyticsRequests).toEqual(
		expect.arrayContaining([
			{
				metric: 'views',
				campaignIds: [21],
				from: '2026-08-23T00:00:00.000Z',
				to: '2026-08-24T23:59:59.999999Z',
			},
			{
				metric: 'clicks',
				campaignIds: [21],
				from: '2026-08-23T00:00:00.000Z',
				to: '2026-08-24T23:59:59.999999Z',
			},
		]),
	);
	await expectNoSeriousAccessibilityViolations(page);

	await request.post(`${upstreamOrigin}/__control/fail-next?provider=campaign-analytics`);
	await page.getByLabel('From').fill('2026-08-22');
	await page.getByRole('button', { name: 'Apply' }).click();
	await expect(page).toHaveURL(/\/emails\/analytics\?campaign=21&from=2026-08-22&to=2026-08-24$/);
	await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(1);
	await expect(page.getByRole('alert')).not.toContainText('fixture confidential campaign analytics diagnostic');
	await expect(page.locator('.campaign-metric-figure')).toHaveCount(1);
	const afterFailure = await request.get(`${upstreamOrigin}/__control/campaign-analytics`);
	expect(((await afterFailure.json()) as { requests: unknown[] }).requests).toHaveLength(3);
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
	await expect(page.locator('.campaign-metric-figure')).toHaveCount(2);
	const afterRetry = await request.get(`${upstreamOrigin}/__control/campaign-analytics`);
	const retriedRequests = (
		(await afterRetry.json()) as {
			requests: Array<{
				metric: string;
				campaignIds: number[];
				from: string;
				to: string;
			}>;
		}
	).requests;
	expect(retriedRequests).toHaveLength(4);
	expect(retriedRequests.slice(2)).toEqual(
		expect.arrayContaining([
			{
				metric: 'views',
				campaignIds: [21],
				from: '2026-08-22T00:00:00.000Z',
				to: '2026-08-24T23:59:59.999999Z',
			},
			{
				metric: 'clicks',
				campaignIds: [21],
				from: '2026-08-22T00:00:00.000Z',
				to: '2026-08-24T23:59:59.999999Z',
			},
		]),
	);

	await page.goto('/emails/analytics?campaign=999&from=2026-08-23&to=2026-08-24');
	await expect(page.getByRole('alert')).toContainText('no longer available');
	const unchanged = await request.get(`${upstreamOrigin}/__control/campaign-analytics`);
	expect(((await unchanged.json()) as { requests: unknown[] }).requests).toHaveLength(4);
	await request.post(`${upstreamOrigin}/__control/reset`);
});

test('campaign test-send resolves one eligible subscriber and never retries an ambiguous v6.2 request', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'Deterministic campaign test-send assertions require the local fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await request.post(`${upstreamOrigin}/__control/campaign-messenger?id=21&messenger=email-primary`);
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${68 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByLabel('Primary navigation')).toBeVisible();
	await page.goto('/emails/subscribers/158');

	const section = page.getByRole('region', { name: 'Send campaign test' });
	await expect(section).toBeVisible();
	await expect(section.getByLabel('Draft campaign')).toHaveCount(0);
	const pickerToggle = section.locator('button[aria-expanded]');
	await expect(pickerToggle).toHaveAttribute('aria-expanded', 'false');
	await pickerToggle.focus();
	await page.keyboard.press('Enter');
	await expect(pickerToggle).toBeFocused();
	await expect(pickerToggle).toHaveAttribute('aria-expanded', 'true');
	await expect(pickerToggle).toHaveText('Hide campaign picker');
	const campaignSelect = section.getByLabel('Draft campaign');
	await expect(campaignSelect).toBeVisible();
	await campaignSelect.selectOption('21');
	await section.getByRole('button', { name: 'Review test email' }).click();
	let dialog = page.getByRole('dialog', { name: 'Send real test email?' });
	await expect(dialog).toContainText('August supporter update');
	await expect(dialog).toContainText('ada.supporter@example.test');
	await expect(dialog).toContainText('real email with live links and tracking');
	await dialog.getByRole('button', { name: 'Queue test email' }).click();
	const acceptedStatus = section.getByRole('status').filter({
		hasText: 'request accepted for ada.supporter@example.test. Delivery is not confirmed.',
	});
	await expect(acceptedStatus).toHaveCount(1);
	await expectNoSeriousAccessibilityViolations(page);

	let testSendState = await request.get(`${upstreamOrigin}/__control/campaign-test-sends`);
	let testSendRequests = (
		(await testSendState.json()) as {
			requests: Array<{ campaignId: number; payload: Record<string, unknown> }>;
		}
	).requests;
	expect(testSendRequests).toHaveLength(1);
	expect(testSendRequests[0]).toEqual({
		campaignId: 21,
		payload: {
			name: 'August supporter update',
			subject: 'What happened in August',
			lists: [11],
			from_email: 'YAH <hello@example.test>',
			messenger: 'email-primary',
			type: 'regular',
			headers: [{ 'x-provider-owned': 'preserve-me' }],
			tags: ['monthly', 'supporters'],
			template_id: 1,
			content_type: 'richtext',
			body: '<p>Fixture campaign body</p>',
			altbody: 'Fixture campaign body',
			body_source: null,
			media: [],
			subscribers: ['ada.supporter@example.test'],
		},
	});
	for (const omitted of ['send_at', 'status', 'progress', 'archive', 'attribs']) {
		expect(testSendRequests[0]?.payload).not.toHaveProperty(omitted);
	}

	await request.post(`${upstreamOrigin}/__control/touch-subscriber?id=158`);
	await section.getByRole('button', { name: 'Review test email' }).click();
	dialog = page.getByRole('dialog', { name: 'Send real test email?' });
	await dialog.getByRole('button', { name: 'Queue test email' }).click();
	await expect(dialog.getByRole('alert')).toContainText('subscriber changed after you opened it');
	testSendState = await request.get(`${upstreamOrigin}/__control/campaign-test-sends`);
	expect(((await testSendState.json()) as { requests: unknown[] }).requests).toHaveLength(1);

	await page.reload();
	const refreshedSection = page.getByRole('region', {
		name: 'Send campaign test',
	});
	await refreshedSection.getByRole('button', { name: 'Choose campaign' }).click();
	await refreshedSection.getByLabel('Draft campaign').selectOption('21');
	await request.post(`${upstreamOrigin}/__control/touch-campaign?id=21`);
	await refreshedSection.getByRole('button', { name: 'Review test email' }).click();
	dialog = page.getByRole('dialog', { name: 'Send real test email?' });
	await dialog.getByRole('button', { name: 'Queue test email' }).click();
	await expect(dialog.getByRole('alert')).toContainText('campaign changed after you opened it');
	testSendState = await request.get(`${upstreamOrigin}/__control/campaign-test-sends`);
	expect(((await testSendState.json()) as { requests: unknown[] }).requests).toHaveLength(1);

	await page.reload();
	const finalSection = page.getByRole('region', { name: 'Send campaign test' });
	await finalSection.getByRole('button', { name: 'Choose campaign' }).click();
	await finalSection.getByLabel('Draft campaign').selectOption('21');
	await request.post(`${upstreamOrigin}/__control/campaign-test-send-outcome?outcome=rejected`);
	await finalSection.getByRole('button', { name: 'Review test email' }).click();
	dialog = page.getByRole('dialog', { name: 'Send real test email?' });
	await dialog.getByRole('button', { name: 'Queue test email' }).click();
	await expect(dialog.getByRole('alert')).toContainText('Listmonk rejected the test-send request');
	testSendState = await request.get(`${upstreamOrigin}/__control/campaign-test-sends`);
	expect(((await testSendState.json()) as { requests: unknown[] }).requests).toHaveLength(1);

	await request.post(`${upstreamOrigin}/__control/campaign-test-send-outcome?outcome=ambiguous`);
	await dialog.getByRole('button', { name: 'Queue test email' }).click();
	const ambiguousError = dialog.getByRole('alert');
	await expect(ambiguousError).toContainText('may have queued this test email');
	await expect(ambiguousError).toContainText('Wait and check the inbox before trying again');
	await expect(ambiguousError).not.toContainText('fixture confidential campaign test-send diagnostic');
	testSendState = await request.get(`${upstreamOrigin}/__control/campaign-test-sends`);
	testSendRequests = (
		(await testSendState.json()) as {
			requests: Array<{ campaignId: number; payload: Record<string, unknown> }>;
		}
	).requests;
	expect(testSendRequests).toHaveLength(2);
	expect(testSendRequests[1]).toEqual(testSendRequests[0]);

	await page.goto('/emails/subscribers/157');
	await expect(page.getByRole('heading', { name: 'Disabled Member' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Send campaign test' })).toHaveCount(0);
	await page.goto('/emails/subscribers/156');
	await expect(page.getByRole('heading', { name: 'Blocklisted Member' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Send campaign test' })).toHaveCount(0);

	await request.post(`${upstreamOrigin}/__control/campaign-messenger?id=21&messenger=webhook`);
	await page.goto('/emails/subscribers/158');
	const nonEmailSection = page.getByRole('region', {
		name: 'Send campaign test',
	});
	await nonEmailSection.getByRole('button', { name: 'Choose campaign' }).click();
	await expect(nonEmailSection.getByText('No ordinary draft email campaigns are available.')).toBeVisible();
});

test('campaign test-send honors permissions split across assigned roles', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'The split-role operator is a local disposable fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${69 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(splitTestSendEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByLabel('Primary navigation')).toBeVisible();
	await page.goto('/emails/subscribers/158');
	const section = page.getByRole('region', { name: 'Send campaign test' });
	await section.getByRole('button', { name: 'Choose campaign' }).click();
	await section.getByLabel('Draft campaign').selectOption('21');
	await section.getByRole('button', { name: 'Review test email' }).click();
	await page.getByRole('dialog', { name: 'Send real test email?' }).getByRole('button', { name: 'Queue test email' }).click();
	await expect(section.getByRole('status')).toContainText('request accepted for ada.supporter@example.test');
	const testSendState = await request.get(`${upstreamOrigin}/__control/campaign-test-sends`);
	expect(((await testSendState.json()) as { requests: unknown[] }).requests).toHaveLength(1);
});

test('a campaign-view-only role lands on campaigns without advertising mutations', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'The campaign-only role is a local disposable fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${61 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(campaignOnlyEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	const emailLink = page.getByLabel('Primary navigation').getByRole('link', { name: 'Email' });
	await expect(emailLink).toHaveAttribute('href', '/emails/campaigns');
	await emailLink.click();
	await expect(page).toHaveURL(/\/emails\/campaigns$/);
	const emailNavigation = page.getByLabel('Email management');
	await expect(emailNavigation.getByRole('link', { name: 'Campaigns' })).toBeVisible();
	await expect(emailNavigation.getByRole('link', { name: 'Email analytics' })).toBeVisible();
	for (const link of ['Templates', 'Lists', 'Forms']) await expect(emailNavigation.getByRole('link', { name: link })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'New campaign' })).toHaveCount(0);
	await page.getByRole('link', { name: 'August supporter update' }).click();
	await expect(page.getByRole('button', { name: 'Preview saved campaign' })).toBeVisible();
	for (const button of ['Save draft', 'Send now', 'Schedule', 'Delete']) await expect(page.getByRole('button', { name: button, exact: true })).toHaveCount(0);
	await expect(page.getByText('Saved content')).toBeVisible();
	await expectNoSeriousAccessibilityViolations(page);
	await page.goto('/emails/campaigns/new');
	await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
});
