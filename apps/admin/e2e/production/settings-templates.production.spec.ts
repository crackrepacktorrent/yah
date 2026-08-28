import {
	expect,
	test,
	expectNoSeriousAccessibilityViolations,
	expectSelectedEmailSection,
	expectSelectedPrimarySection,
	ownerEmail,
	ownerPassword,
	upstreamOrigin,
} from '../production-test';

test('email operators can safely update SMTP settings, test delivery, and inspect redacted logs', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_PRODUCTION_E2E_BASE_URL'], 'Deterministic Listmonk settings assertions require the local fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${70 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await page.getByLabel('Primary navigation').getByRole('link', { name: 'Settings' }).click();
	await expect(page).toHaveURL(/\/settings\/email$/);
	await expectSelectedPrimarySection(page, 'Settings');
	await expect(page.getByRole('heading', { name: 'Email delivery' })).toBeVisible();
	await expect(page.getByText('Unexposed Listmonk settings and custom SMTP headers are preserved on every save.')).toBeVisible();
	await expect(page.getByLabel('Host', { exact: true })).toHaveValue('smtp.example.test');
	await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('placeholder', 'Saved password');

	await page.getByLabel('Host', { exact: true }).fill('smtp-updated.example.test');
	await page.getByLabel('Password', { exact: true }).fill('fixture-new-smtp-password');
	await page.getByLabel('Test recipient', { exact: true }).fill('operator@example.test');
	await page.getByRole('button', { name: 'Send test' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'SMTP test message sent.' })).toBeVisible();
	await page.getByRole('button', { name: 'Save SMTP settings' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'SMTP settings saved.' })).toBeVisible();
	await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
	await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('placeholder', 'Saved password');

	const settingsNavigation = page.getByLabel('Email settings');
	for (const name of ['General', 'SMTP delivery', 'Performance', 'Bounces', 'Privacy', 'Provider']) await expect(settingsNavigation.getByRole('link', { name })).toBeVisible();
	await settingsNavigation.getByRole('link', { name: 'General' }).click();
	await expect(page).toHaveURL(/\/settings\/email\/general$/);
	await expect(page.getByRole('heading', { name: 'General email settings' })).toBeVisible();
	await expect(page.getByText('Public subscription API').locator('..')).toContainText('Enabled');
	await expect(page.getByText('Recipient link base').locator('..')).toContainText('https://mail.example.test');
	await expectNoSeriousAccessibilityViolations(page);
	await page.getByLabel('Site name').fill('YAH Updates');
	await page.getByLabel('Logo URL').fill('https://example.test/yah-mark.png');
	await page.getByLabel('Default from address').fill('YAH Updates <updates@example.test>');
	await page.getByLabel('Operator notification emails').fill('ops@example.test\nalerts@example.test');
	await page.getByLabel('Send opt-in confirmation messages').uncheck();
	await page.getByLabel('Show the opt-in confirmation page').uncheck();
	await page.getByLabel('Enable the public campaign archive').check();
	await page.getByLabel('Include full campaign content in archive RSS').check();
	await page.getByRole('button', { name: 'Save general settings' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'General email settings saved.' })).toBeVisible();

	await settingsNavigation.getByRole('link', { name: 'Performance' }).click();
	await expect(page).toHaveURL(/\/settings\/email\/performance$/);
	await expect(page.getByRole('heading', { name: 'Email performance' })).toBeVisible();
	await expectNoSeriousAccessibilityViolations(page);
	await page.getByLabel('Maximum send errors').fill('900');
	await page.getByLabel('Enable a sliding-window limit').check();
	await page.getByLabel('Messages per window').fill('500');
	await page.getByLabel('Window duration').fill('1h');
	await page.getByRole('button', { name: 'Save performance settings' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Performance settings saved.' })).toBeVisible();

	await settingsNavigation.getByRole('link', { name: 'Bounces' }).click();
	await expect(page).toHaveURL(/\/settings\/email\/bounces$/);
	await expect(page.getByRole('heading', { name: 'Bounce processing' })).toBeVisible();
	await expectNoSeriousAccessibilityViolations(page);
	const hardBounceRow = page.getByRole('group', { name: 'Bounce actions' }).locator('.bounce-action-row').filter({ hasText: 'Hard bounce' });
	await hardBounceRow.getByLabel('Action').selectOption('unsubscribe');
	await page.getByLabel('Lettermint').check();
	await page.getByLabel('Enable this mailbox').check();
	await page.getByRole('button', { name: 'Save bounce settings' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Bounce settings saved.' })).toBeVisible();

	await settingsNavigation.getByRole('link', { name: 'Privacy' }).click();
	await expect(page).toHaveURL(/\/settings\/email\/privacy$/);
	await expect(page.getByRole('heading', { name: 'Email privacy' })).toBeVisible();
	await expectNoSeriousAccessibilityViolations(page);
	await page.getByLabel('Disable all message tracking').check();
	await expect(page.getByLabel('Associate tracking with individual recipients')).toBeDisabled();
	await page.getByLabel('Allow data wipe').uncheck();
	await page.getByLabel('Link clicks').uncheck();
	await page.getByLabel('Blocked domains').fill('Blocked.Example\nblocked.example\ndeny.example');
	await page.getByLabel('Allowed domains').fill('allow.example');
	await page.getByRole('button', { name: 'Save privacy policy' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Privacy policy saved.' })).toBeVisible();

	const fixtureState = await (await request.get(`${upstreamOrigin}/__control/email-settings`)).json();
	expect(fixtureState.settings.smtp[0]).toMatchObject({
		host: 'smtp-updated.example.test',
		email_headers: [{ 'X-Provider': 'keep-me' }],
	});
	expect(fixtureState.settings['appearance.admin.custom_css']).toContain('••');
	expect(fixtureState.settings).toMatchObject({
		'app.site_name': 'YAH Updates',
		'app.logo_url': 'https://example.test/yah-mark.png',
		'app.from_email': 'YAH Updates <updates@example.test>',
		'app.notify_emails': ['ops@example.test', 'alerts@example.test'],
		'app.send_optin_confirmation': false,
		'app.show_optin_page': false,
		'app.enable_public_archive': true,
		'app.enable_public_archive_rss_content': true,
		'app.max_send_errors': 900,
		'app.message_sliding_window': true,
		'app.message_sliding_window_rate': 500,
		'bounce.lettermint': { enabled: true },
		'privacy.disable_tracking': true,
		'privacy.individual_tracking': true,
		'privacy.allow_wipe': false,
		'privacy.domain_blocklist': ['blocked.example', 'deny.example'],
		'privacy.domain_allowlist': ['allow.example'],
		'privacy.exportable': ['profile', 'subscriptions', 'campaign_views'],
	});
	expect(fixtureState.settings['bounce.actions'].hard).toEqual({
		count: 1,
		action: 'unsubscribe',
	});
	expect(fixtureState.settings['bounce.mailboxes'][0]).toMatchObject({
		enabled: true,
		password: '••••••',
	});
	expect(fixtureState.settings['bounce.lettermint'].key).toBe('••••');
	expect(fixtureState.smtpTestRequests).toEqual([
		{
			authProtocol: 'login',
			email: 'operator@example.test',
			hadPassword: true,
			host: 'smtp-updated.example.test',
		},
	]);
	await settingsNavigation.getByRole('link', { name: 'Provider' }).click();
	await expect(page.getByRole('heading', { name: 'Provider-owned settings' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Private Listmonk operator UI' })).toBeVisible();
	await expectNoSeriousAccessibilityViolations(page);

	await page.getByLabel('Primary navigation').getByRole('link', { name: 'Email', exact: true }).click();
	await page.getByLabel('Email management').getByRole('link', { name: 'Logs', exact: true }).click();
	await expect(page).toHaveURL(/\/emails\/logs$/);
	await expectSelectedPrimarySection(page, 'Email');
	await expectSelectedEmailSection(page, 'Logs');
	await expect(page.getByRole('heading', { name: 'Process logs' })).toBeVisible();
	const log = page.getByRole('log', { name: 'Listmonk process logs' });
	await expect(log).toContainText('authorization: Bearer [REDACTED] password=[REDACTED] delivery diagnostic');
	await expect(log).not.toContainText('fixture-log-token');
	await expect(log).not.toContainText('fixture-log-secret');
	await expect(page.getByText('Showing 200 of 205 buffered lines · page 1 of 2')).toBeVisible();
	await page.getByRole('link', { name: 'Older' }).click();
	await expect(page).toHaveURL(/\/emails\/logs\?page=2$/);
	await expect(page.getByText('2026-08-27T10:00:00Z listmonk started')).toBeVisible();
	await expectNoSeriousAccessibilityViolations(page);
});

test('email templates use route editors, provider previews, exact defaults, and single deletion', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_PRODUCTION_E2E_BASE_URL'], 'Deterministic Listmonk assertions require the local fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${55 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	const navigation = page.getByLabel('Primary navigation');
	await expect(navigation.getByRole('link', { name: 'Email' })).toBeVisible();
	await navigation.getByRole('link', { name: 'Email' }).click();
	await expect(page).toHaveURL(/\/emails$/);
	await expect(page.getByRole('heading', { name: 'Email templates' })).toBeVisible();
	await expect(page.getByRole('table', { name: 'Email templates' })).toBeVisible();
	await expect(page.getByLabel('Email management').getByRole('link', { name: 'Templates' })).toBeVisible();
	await expectSelectedEmailSection(page, 'Templates');
	await expectNoSeriousAccessibilityViolations(page);

	await expect(page.getByRole('searchbox')).toHaveCount(0);
	await page.getByRole('link', { name: 'Visual newsletter' }).click();
	await expect(page).toHaveURL(/\/emails\/templates\/4$/);
	await expectSelectedEmailSection(page, 'Templates');
	await expect(page.getByText('Visual template content is read-only here.')).toBeVisible();
	await expect(page.getByText('Available in Listmonk')).toBeVisible();
	await expect(page.getByLabel('Body (HTML)')).toHaveCount(0);
	await page.getByRole('button', { name: 'Render saved preview' }).click();
	const savedPreview = page.getByTitle('Rendered email template preview');
	await expect(savedPreview).toHaveAttribute('sandbox', '');
	await expect(savedPreview).toHaveAttribute('referrerpolicy', 'no-referrer');
	await expect(savedPreview.contentFrame().getByText('Visual fixture preview')).toBeVisible();
	await expectNoSeriousAccessibilityViolations(page, ['iframe[title="Rendered email template preview"]']);

	await page.getByLabel('Breadcrumb').getByRole('link', { name: 'Email templates' }).click();
	await request.post(`${upstreamOrigin}/__control/fail-next?provider=listmonk`);
	await page.reload();
	await expect(page.getByRole('alert')).toContainText(/An unexpected error occurred\. Reference: [a-f0-9]{8}/);
	await expect(page.getByRole('alert')).not.toContainText('fixture confidential listmonk diagnostic');
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByRole('table', { name: 'Email templates' })).toBeVisible();

	await expect(page.getByRole('link', { name: 'Admin access' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Password reset' })).toBeVisible();
	await page.getByRole('link', { name: 'Admin access' }).click();
	await expect(page).toHaveURL(/\/emails\/templates\/5$/);
	await expect(page.getByRole('heading', { name: 'Admin access' })).toBeVisible();
	await expect(page.getByLabel('Type')).toBeDisabled();
	await page.getByLabel('Subject').fill('Updated admin access');
	await page.getByLabel('Body (HTML)').fill('<p>Review {{ .Tx.Data.review_code }}</p>');
	await page.getByRole('button', { name: 'Render preview' }).click();
	const preview = page.getByTitle('Rendered email template preview');
	await expect(preview).toHaveAttribute('sandbox', '');
	await expect(preview).toHaveAttribute('referrerpolicy', 'no-referrer');
	await expect(preview.contentFrame().getByText('[review_code]')).toBeVisible();
	// The provider-rendered document is untrusted content inside a scriptless,
	// unique-origin sandbox. Axe cannot inject its script there; the admin-owned
	// iframe contract itself (title + sandbox) is asserted immediately above.
	await expectNoSeriousAccessibilityViolations(page, ['iframe[title="Rendered email template preview"]']);
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Email template updated.' })).toBeVisible();

	await page.getByLabel('Breadcrumb').getByRole('link', { name: 'Email templates' }).click();
	await page.getByRole('link', { name: 'New template' }).click();
	await expect(page).toHaveURL(/\/emails\/templates\/new$/);
	await expectSelectedEmailSection(page, 'Templates');
	await page.getByLabel(/Name/).fill('Review campaign');
	await page.getByLabel('Type').selectOption('campaign');
	await expect(page.getByLabel('Subject')).toHaveCount(0);
	await page.getByLabel('Body (HTML)').fill('<main>No content slot</main>');
	await page.getByRole('button', { name: 'Create template' }).click();
	await expect(page.getByRole('alert')).toContainText('exactly one');
	await page.getByLabel('Body (HTML)').fill('<main>{{ template "content" . }}</main>');
	await page.getByRole('button', { name: 'Render preview' }).click();
	await expect(page.getByTitle('Rendered email template preview').contentFrame().getByText('Fixture campaign content')).toBeVisible();
	await page.getByRole('button', { name: 'Create template' }).click();
	await expect(page).toHaveURL(/\/emails\/templates\/7$/);
	await expect(page.getByRole('heading', { name: 'Review campaign' })).toBeVisible();
	await page.getByRole('button', { name: 'Set as default' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Default campaign template updated.' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);

	await page.getByLabel('Breadcrumb').getByRole('link', { name: 'Email templates' }).click();
	const reviewRow = page.getByRole('row').filter({ hasText: 'Review campaign' });
	await expect(reviewRow.getByText('Default')).toBeVisible();
	await page.getByRole('link', { name: 'New template' }).click();
	await page.getByLabel(/Name/).fill('Temporary transactional template');
	await page.getByLabel('Subject').fill('Temporary subject');
	await page.getByLabel('Body (HTML)').fill('<p>Temporary body</p>');
	await page.getByRole('button', { name: 'Create template' }).click();
	await expect(page.getByRole('heading', { name: 'Temporary transactional template' })).toBeVisible();

	const deleteButton = page.getByRole('button', {
		name: 'Delete',
		exact: true,
	});
	await deleteButton.click();
	await expect(page.getByRole('dialog', { name: 'Delete email template?' }).getByRole('button', { name: 'Cancel' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(deleteButton).toBeFocused();
	await deleteButton.click();
	await page.getByRole('dialog', { name: 'Delete email template?' }).getByRole('button', { name: 'Delete template' }).click();
	await expect(page).toHaveURL(/\/emails$/);
	await expect(page.getByRole('link', { name: 'Temporary transactional template' })).toHaveCount(0);
});
