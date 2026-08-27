import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { requireDisposableProductionE2EDatabase } from './production-environment';

const compatibilityOrigin = 'http://127.0.0.1:43121';
const productionOrigin = process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'] ?? 'http://127.0.0.1:43123';
const upstreamOrigin = 'http://127.0.0.1:43124';
const ownerEmail = 'owner-one@example.test';
const ownerPassword = 'owner-one-test-password-2026';
const invitedEmail = 'invited-member@example.test';
const invitedUserId = 'admin-v2-e2e-invited-user';
const invitedAccountId = 'admin-v2-e2e-invited-account';
const deniedEmail = 'no-analytics@example.test';
const deniedUserId = 'admin-v2-e2e-no-analytics-user';
const deniedAccountId = 'admin-v2-e2e-no-analytics-account';
const deniedMemberId = 'admin-v2-e2e-no-analytics-member';
const deniedRoleId = 'admin-v2-e2e-no-analytics-role';
const deniedRole = 'admin-v2-no-analytics';
const listOnlyEmail = 'list-reader@example.test';
const listOnlyUserId = 'admin-v2-e2e-list-reader-user';
const listOnlyAccountId = 'admin-v2-e2e-list-reader-account';
const listOnlyMemberId = 'admin-v2-e2e-list-reader-member';
const listOnlyRoleId = 'admin-v2-e2e-list-reader-role';
const listOnlyRole = 'admin-v2-list-reader';
const subscriberOnlyEmail = 'subscriber-reader@example.test';
const subscriberOnlyUserId = 'admin-v2-e2e-subscriber-reader-user';
const subscriberOnlyAccountId = 'admin-v2-e2e-subscriber-reader-account';
const subscriberOnlyMemberId = 'admin-v2-e2e-subscriber-reader-member';
const subscriberOnlyRoleId = 'admin-v2-e2e-subscriber-reader-role';
const subscriberOnlyRole = 'admin-v2-subscriber-reader';
const splitTestSendEmail = 'split-test-send@example.test';
const splitTestSendUserId = 'admin-v2-e2e-split-test-send-user';
const splitTestSendAccountId = 'admin-v2-e2e-split-test-send-account';
const splitTestSendMemberId = 'admin-v2-e2e-split-test-send-member';
const splitTestSendCampaignRoleId = 'admin-v2-e2e-split-test-send-campaign-role';
const splitTestSendCampaignRole = 'admin-v2-split-test-send-campaign';
const campaignOnlyEmail = 'campaign-reader@example.test';
const campaignOnlyUserId = 'admin-v2-e2e-campaign-reader-user';
const campaignOnlyAccountId = 'admin-v2-e2e-campaign-reader-account';
const campaignOnlyMemberId = 'admin-v2-e2e-campaign-reader-member';
const campaignOnlyRoleId = 'admin-v2-e2e-campaign-reader-role';
const campaignOnlyRole = 'admin-v2-campaign-reader';
const bounceOnlyEmail = 'bounce-reader@example.test';
const bounceOnlyUserId = 'admin-v2-e2e-bounce-reader-user';
const bounceOnlyAccountId = 'admin-v2-e2e-bounce-reader-account';
const bounceOnlyMemberId = 'admin-v2-e2e-bounce-reader-member';
const bounceOnlyRoleId = 'admin-v2-e2e-bounce-reader-role';
const bounceOnlyRole = 'admin-v2-bounce-reader';
const isolatedEmail = 'shortlink-editor@example.test';
const isolatedUserId = 'admin-v2-e2e-shortlink-editor-user';
const isolatedAccountId = 'admin-v2-e2e-shortlink-editor-account';
const isolatedMemberId = 'admin-v2-e2e-shortlink-editor-member';
const isolatedRoleId = 'admin-v2-e2e-shortlink-editor-role';
const isolatedRole = 'admin-v2-shortlink-editor';
const accessUserId = 'admin-v2-e2e-access-target';
const accessAccountId = 'admin-v2-e2e-access-target-account';
const accessMemberId = 'admin-v2-e2e-access-target-member';
const accessEmail = 'access-target@example.test';
const accessInvitationEmail = 'access-invitation@example.test';
const accessRole = 'e2e-access-reviewer';
const redactedInvitationId = 'admin-v2-e2e-redacted-invitation';
const canceledInvitationId = 'admin-v2-e2e-canceled-invitation';
const acceptedInvitationId = 'admin-v2-e2e-accepted-invitation';
const fixtureInvitationIds = [redactedInvitationId, canceledInvitationId, acceptedInvitationId];

let fixturePool: Pool | undefined;
let canonicalOrganizationId = '';
let canonicalOrganizationName = '';
let ownerUserId = '';
let originalOwnerSessionIds: string[] = [];

async function expectNoSeriousAccessibilityViolations(page: Page, excludedSelectors: string[] = []): Promise<void> {
	const builder = new AxeBuilder({ page });
	for (const selector of excludedSelectors) builder.exclude(selector);
	const results = await builder.analyze();
	const violations = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
	expect(
		violations.map(({ id, impact, nodes }) => ({
			id,
			impact,
			targets: nodes.map((node) => node.target),
		})),
		'serious or critical axe violations',
	).toEqual([]);
}

async function expectSelectedEmailSection(page: Page, name: string): Promise<void> {
	const navigation = page.getByLabel('Email management');
	await expect(navigation.locator('a[data-selected]')).toHaveCount(1);
	await expect(navigation.getByRole('link', { name, exact: true })).toHaveAttribute('data-selected', 'true');
}

test.beforeAll(async () => {
	fixturePool = new Pool({
		connectionString: requireDisposableProductionE2EDatabase(),
	});
	const client = await fixturePool.connect();
	try {
		await client.query('BEGIN');
		await client.query("SET LOCAL yah.allow_test_role_delete = 'on'");
		await client.query('DELETE FROM invitation WHERE id = ANY($1::text[]) OR email = $2', [fixtureInvitationIds, accessInvitationEmail]);
		await client.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [[invitedUserId, deniedUserId, listOnlyUserId, subscriberOnlyUserId, splitTestSendUserId, campaignOnlyUserId, bounceOnlyUserId, isolatedUserId, accessUserId]]);
		await client.query('DELETE FROM "organizationRole" WHERE id = ANY($1::text[]) OR role = $2', [[deniedRoleId, listOnlyRoleId, subscriberOnlyRoleId, splitTestSendCampaignRoleId, campaignOnlyRoleId, bounceOnlyRoleId, isolatedRoleId], accessRole]);

		const fixtureSource = await client.query<{
			organizationId: string;
			organizationName: string;
			ownerId: string;
			password: string;
		}>(
			`SELECT o.id AS "organizationId", o.name AS "organizationName", u.id AS "ownerId", a.password
			 FROM organization o
			 JOIN member m ON m."organizationId" = o.id AND m.role = 'owner'
			 JOIN "user" u ON u.id = m."userId" AND u.email = $1
			 JOIN account a ON a."userId" = u.id AND a."providerId" = 'credential'
			 WHERE o.slug = 'yah'`,
			[ownerEmail],
		);
		const source = fixtureSource.rows[0];
		if (!source?.password) throw new Error('The production browser suite requires the bootstrapped canonical owner.');
		canonicalOrganizationId = source.organizationId;
		canonicalOrganizationName = source.organizationName;
		ownerUserId = source.ownerId;
		const ownerSessions = await client.query<{ id: string }>('SELECT id FROM session WHERE "userId" = $1', [source.ownerId]);
		originalOwnerSessionIds = ownerSessions.rows.map(({ id }) => id);

		await client.query(
			`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
			 VALUES ($1, 'Invited Test Member', $2, TRUE, NOW(), NOW())`,
			[invitedUserId, invitedEmail],
		);
		await client.query(
			`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
			 VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
			[invitedAccountId, invitedUserId, source.password],
		);
		await client.query(
			`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
			 VALUES ($1, 'No Analytics Test Member', $2, TRUE, NOW(), NOW())`,
			[deniedUserId, deniedEmail],
		);
		await client.query(
			`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
			 VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
			[deniedAccountId, deniedUserId, source.password],
		);
		await client.query(
			`INSERT INTO "organizationRole" (id, "organizationId", role, permission, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
			[
				deniedRoleId,
				source.organizationId,
				deniedRole,
				JSON.stringify({ shortlink: ['view'], template: ['view', 'set-default'], list: ['view'] }),
			],
		);
		await client.query(
			`INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
			 VALUES ($1, $2, $3, $4, NOW())`,
			[deniedMemberId, source.organizationId, deniedUserId, deniedRole],
		);
		await client.query(
			`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
			 VALUES ($1, 'Mailing List Reader', $2, TRUE, NOW(), NOW())`,
			[listOnlyUserId, listOnlyEmail],
		);
		await client.query(
			`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
			 VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
			[listOnlyAccountId, listOnlyUserId, source.password],
		);
		await client.query(
			`INSERT INTO "organizationRole" (id, "organizationId", role, permission, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
			[listOnlyRoleId, source.organizationId, listOnlyRole, JSON.stringify({ list: ['view'] })],
		);
		await client.query(
			`INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
			 VALUES ($1, $2, $3, $4, NOW())`,
			[listOnlyMemberId, source.organizationId, listOnlyUserId, listOnlyRole],
		);
		await client.query(
			`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
			 VALUES ($1, 'Subscriber Reader', $2, TRUE, NOW(), NOW())`,
			[subscriberOnlyUserId, subscriberOnlyEmail],
		);
		await client.query(
			`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
			 VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
			[subscriberOnlyAccountId, subscriberOnlyUserId, source.password],
		);
		await client.query(
			`INSERT INTO "organizationRole" (id, "organizationId", role, permission, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
			[subscriberOnlyRoleId, source.organizationId, subscriberOnlyRole, JSON.stringify({ subscriber: ['view'] })],
		);
		await client.query(
			`INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
			 VALUES ($1, $2, $3, $4, NOW())`,
			[subscriberOnlyMemberId, source.organizationId, subscriberOnlyUserId, subscriberOnlyRole],
		);
		await client.query(
			`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
			 VALUES ($1, 'Split Test-send Operator', $2, TRUE, NOW(), NOW())`,
			[splitTestSendUserId, splitTestSendEmail],
		);
		await client.query(
			`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
			 VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
			[splitTestSendAccountId, splitTestSendUserId, source.password],
		);
		await client.query(
			`INSERT INTO "organizationRole" (id, "organizationId", role, permission, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
			[splitTestSendCampaignRoleId, source.organizationId, splitTestSendCampaignRole, JSON.stringify({ campaign: ['view', 'send'] })],
		);
		await client.query(
			`INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
			 VALUES ($1, $2, $3, $4, NOW())`,
			[splitTestSendMemberId, source.organizationId, splitTestSendUserId, `${subscriberOnlyRole},${splitTestSendCampaignRole}`],
		);
		await client.query(
			`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
			 VALUES ($1, 'Campaign Reader', $2, TRUE, NOW(), NOW())`,
			[campaignOnlyUserId, campaignOnlyEmail],
		);
		await client.query(
			`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
			 VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
			[campaignOnlyAccountId, campaignOnlyUserId, source.password],
		);
		await client.query(
			`INSERT INTO "organizationRole" (id, "organizationId", role, permission, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
			[campaignOnlyRoleId, source.organizationId, campaignOnlyRole, JSON.stringify({ campaign: ['view'] })],
		);
		await client.query(
			`INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
			 VALUES ($1, $2, $3, $4, NOW())`,
			[campaignOnlyMemberId, source.organizationId, campaignOnlyUserId, campaignOnlyRole],
		);
		await client.query(
			`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
			 VALUES ($1, 'Bounce Reader', $2, TRUE, NOW(), NOW())`,
			[bounceOnlyUserId, bounceOnlyEmail],
		);
		await client.query(
			`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
			 VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
			[bounceOnlyAccountId, bounceOnlyUserId, source.password],
		);
		await client.query(
			`INSERT INTO "organizationRole" (id, "organizationId", role, permission, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
			[bounceOnlyRoleId, source.organizationId, bounceOnlyRole, JSON.stringify({ bounce: ['view'] })],
		);
		await client.query(
			`INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
			 VALUES ($1, $2, $3, $4, NOW())`,
			[bounceOnlyMemberId, source.organizationId, bounceOnlyUserId, bounceOnlyRole],
		);
		await client.query(
			`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
			 VALUES ($1, 'Shortlink Editor', $2, TRUE, NOW(), NOW())`,
			[isolatedUserId, isolatedEmail],
		);
		await client.query(
			`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
			 VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
			[isolatedAccountId, isolatedUserId, source.password],
		);
		await client.query(
			`INSERT INTO "organizationRole" (id, "organizationId", role, permission, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
			[isolatedRoleId, source.organizationId, isolatedRole, JSON.stringify({ shortlink: ['create', 'edit'] })],
		);
		await client.query(
			`INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
			 VALUES ($1, $2, $3, $4, NOW())`,
			[isolatedMemberId, source.organizationId, isolatedUserId, isolatedRole],
		);
		await client.query(
			`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
			 VALUES ($1, 'Access Target', $2, TRUE, NOW(), NOW())`,
			[accessUserId, accessEmail],
		);
		await client.query(
			`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
			 VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
			[accessAccountId, accessUserId, source.password],
		);
		await client.query(
			`INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
			 VALUES ($1, $2, $3, 'member', NOW())`,
			[accessMemberId, source.organizationId, accessUserId],
		);
		await client.query(
			`INSERT INTO invitation (id, "organizationId", email, role, status, "expiresAt", "createdAt", "inviterId")
			 VALUES
			 ($1, $4, 'private-pending-invite@example.test', 'owner', 'pending', NOW() + INTERVAL '1 day', NOW(), $5),
			 ($2, $4, 'private-canceled-invite@example.test', 'admin', 'canceled', NOW() + INTERVAL '1 day', NOW(), $5),
			 ($3, $4, $6, $7, 'pending', NOW() + INTERVAL '1 day', NOW(), $5)`,
			[redactedInvitationId, canceledInvitationId, acceptedInvitationId, source.organizationId, source.ownerId, invitedEmail, deniedRole],
		);
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK').catch(() => undefined);
		throw error;
	} finally {
		client.release();
	}
});

test.afterAll(async () => {
	if (!fixturePool) return;
	const client = await fixturePool.connect();
	try {
		if (ownerUserId) {
			await client.query('DELETE FROM session WHERE "userId" = $1 AND NOT (id = ANY($2::text[]))', [ownerUserId, originalOwnerSessionIds]);
		}
		await client.query('BEGIN');
		await client.query("SET LOCAL yah.allow_test_role_delete = 'on'");
		await client.query('DELETE FROM invitation WHERE id = ANY($1::text[]) OR email = $2', [fixtureInvitationIds, accessInvitationEmail]);
		await client.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [[invitedUserId, deniedUserId, listOnlyUserId, subscriberOnlyUserId, splitTestSendUserId, campaignOnlyUserId, bounceOnlyUserId, isolatedUserId, accessUserId]]);
		await client.query('DELETE FROM "organizationRole" WHERE id = ANY($1::text[]) OR role = $2', [[deniedRoleId, listOnlyRoleId, subscriberOnlyRoleId, splitTestSendCampaignRoleId, campaignOnlyRoleId, bounceOnlyRoleId, isolatedRoleId], accessRole]);
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK').catch(() => undefined);
		throw error;
	} finally {
		client.release();
		await fixturePool.end();
	}
});

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

test('analytics is permission-discoverable, keyboard-selectable, semantic, and safely retryable', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'Deterministic analytics assertions require the local fixture.');
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

	await page.getByLabel('7d').focus();
	await page.keyboard.press('ArrowLeft');
	await expect(page.getByLabel('24h')).toBeChecked();
	await expect(pageviewStat).toHaveText('100');
	await page.keyboard.press('ArrowLeft');
	await expect(page.getByLabel('30d')).toBeChecked();
	await expect(pageviewStat).toHaveText('3,000');

	const control = await request.post(`${upstreamOrigin}/__control/fail-next`);
	expect(control.ok()).toBe(true);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
	// Solid's client error boundary intentionally collapses the server's
	// correlation-bearing safe error to the generic public message. The server
	// log retains the reference without transporting provider details.
	await expect(page.getByRole('alert')).toContainText('An unexpected error occurred.');
	await expect(page.getByRole('alert')).not.toContainText('fixture confidential diagnostic');
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
	await expect(pageviewStat).toHaveText('700');
});

test('shortlinks preserve the typed CRUD workflow and dashboard panels fail independently', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'Deterministic Shlink assertions require the local fixture.');
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

test('email templates use route editors, provider previews, exact defaults, and single deletion', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'Deterministic Listmonk assertions require the local fixture.');
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

	const filter = page.getByLabel('Filter templates');
	await filter.fill('visual');
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

	await filter.fill('admin access');
	await expect(page.getByRole('link', { name: 'Admin access' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Password reset' })).toHaveCount(0);
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

	const deleteButton = page.getByRole('button', { name: 'Delete', exact: true });
	await deleteButton.click();
	await expect(page.getByRole('dialog', { name: 'Delete email template?' }).getByRole('button', { name: 'Cancel' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(deleteButton).toBeFocused();
	await deleteButton.click();
	await page.getByRole('dialog', { name: 'Delete email template?' }).getByRole('button', { name: 'Delete template' }).click();
	await expect(page).toHaveURL(/\/emails$/);
	await expect(page.getByRole('link', { name: 'Temporary transactional template' })).toHaveCount(0);
});

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

	const filter = page.getByLabel('Filter mailing lists');
	await filter.fill('temporary');
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

	await filter.fill('volunteer');
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
	expect((await preserved.json() as { data: { tags: string[] } }).data.tags).toEqual(['volunteers', 'internal']);

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

	const deleteButton = page.getByRole('button', { name: 'Delete', exact: true });
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

test('campaigns preserve provider state, enforce stale versions, and use truthful status and opt-in workflows', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'Deterministic campaign assertions require the local fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({ 'x-forwarded-for': `127.0.0.${58 + testInfo.retry}` });
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await page.getByLabel('Primary navigation').getByRole('link', { name: 'Email' }).click();
	const emailNavigation = page.getByLabel('Email management');
	await emailNavigation.getByRole('link', { name: 'Campaigns' }).click();
	await expect(page).toHaveURL(/\/emails\/campaigns$/);
	await expectSelectedEmailSection(page, 'Campaigns');
	const table = page.getByRole('table', { name: 'Campaigns, delivery status, target lists, and progress' });
	await expect(table).toBeVisible();
	await expect(page.getByRole('link', { name: 'August supporter update' })).toBeVisible();
	await expect(page.getByRole('columnheader', { name: 'Updated' })).toBeVisible();
	await expect(table.locator('th button, [aria-sort]')).toHaveCount(0);
	await expect(page.getByRole('searchbox')).toHaveCount(0);
	await expectNoSeriousAccessibilityViolations(page);

	await page.getByRole('link', { name: 'August supporter update' }).click();
	await expect(page.getByRole('heading', { name: 'August supporter update' })).toBeVisible();
	await expectSelectedEmailSection(page, 'Campaigns');
	await expect(page.getByLabel('Campaign template').locator('option')).toHaveText([
		'Default campaign template',
		'Default campaign',
	]);
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
	await page.getByRole('textbox', { name: 'Campaign content' }).fill('Updated fixture campaign content');
	await page.getByRole('button', { name: 'Save draft' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Campaign draft updated.' })).toBeVisible();
	await expect(page.getByTitle('Rendered saved campaign preview')).toHaveCount(0);

	const providerState = await request.get(`${upstreamOrigin}/__control/campaigns`);
	expect(providerState.ok()).toBe(true);
	const providerCampaigns = (await providerState.json() as { campaigns: Array<Record<string, unknown>> }).campaigns;
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
	const optinCampaign = (await optinState.json() as { campaigns: Array<Record<string, unknown>> }).campaigns.find(({ id }) => id === 22);
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
	const deleteDialog = page.getByRole('dialog', { name: 'Delete selected draft campaigns?' });
	await expect(deleteDialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
	await deleteDialog.getByRole('button', { name: 'Delete campaigns' }).click();
	await expect(page.getByRole('link', { name: 'Press confirmation resend' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Press confirmation companion' })).toHaveCount(0);
	await request.post(`${upstreamOrigin}/__control/reset`);
});

test('email analytics uses URL-owned native filters and one provider request per metric', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'Deterministic campaign analytics assertions require the local fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({ 'x-forwarded-for': `127.0.0.${67 + testInfo.retry}` });
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
	await page.getByRole('button', { name: 'Apply' }).click();
	await expect(page).toHaveURL(/\/emails\/analytics\?campaign=21&from=2026-08-23&to=2026-08-24$/);
	await expect(page.getByRole('heading', { name: 'Email views' })).toBeVisible();
	await expect(page.getByText('25 total views')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Link clicks' })).toBeVisible();
	await expect(page.getByText('7 total clicks')).toBeVisible();
	await expect(page.locator('.campaign-metric-figure li')).toHaveCount(6);
	await expect(page.getByText('Aug 23, 2026, 1:00 AM UTC')).toHaveCount(2);
	await expect(page.getByText('Aug 23, 2026, 2:00 PM UTC')).toHaveCount(2);

	const control = await request.get(`${upstreamOrigin}/__control/campaign-analytics`);
	expect(control.ok()).toBe(true);
	const analyticsRequests = (await control.json() as {
		requests: Array<{ metric: string; campaignIds: number[]; from: string; to: string }>;
	}).requests;
	expect(analyticsRequests).toHaveLength(2);
	expect(analyticsRequests).toEqual(expect.arrayContaining([
		{ metric: 'views', campaignIds: [21], from: '2026-08-23T00:00:00.000Z', to: '2026-08-24T23:59:59.999999Z' },
		{ metric: 'clicks', campaignIds: [21], from: '2026-08-23T00:00:00.000Z', to: '2026-08-24T23:59:59.999999Z' },
	]));
	await expectNoSeriousAccessibilityViolations(page);

	await request.post(`${upstreamOrigin}/__control/fail-next?provider=campaign-analytics`);
	await page.getByLabel('From').fill('2026-08-22');
	await page.getByRole('button', { name: 'Apply' }).click();
	await expect(page).toHaveURL(/\/emails\/analytics\?campaign=21&from=2026-08-22&to=2026-08-24$/);
	await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(1);
	await expect(page.getByRole('alert')).not.toContainText('fixture confidential campaign analytics diagnostic');
	await expect(page.locator('.campaign-metric-figure')).toHaveCount(1);
	const afterFailure = await request.get(`${upstreamOrigin}/__control/campaign-analytics`);
	expect((await afterFailure.json() as { requests: unknown[] }).requests).toHaveLength(3);
	await page.getByRole('button', { name: 'Try again' }).click();
	await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
	await expect(page.locator('.campaign-metric-figure')).toHaveCount(2);
	const afterRetry = await request.get(`${upstreamOrigin}/__control/campaign-analytics`);
	const retriedRequests = (await afterRetry.json() as {
		requests: Array<{ metric: string; campaignIds: number[]; from: string; to: string }>;
	}).requests;
	expect(retriedRequests).toHaveLength(4);
	expect(retriedRequests.slice(2)).toEqual(expect.arrayContaining([
		{ metric: 'views', campaignIds: [21], from: '2026-08-22T00:00:00.000Z', to: '2026-08-24T23:59:59.999999Z' },
		{ metric: 'clicks', campaignIds: [21], from: '2026-08-22T00:00:00.000Z', to: '2026-08-24T23:59:59.999999Z' },
	]));

	await page.goto('/emails/analytics?campaign=999&from=2026-08-23&to=2026-08-24');
	await expect(page.getByRole('alert')).toContainText('no longer available');
	const unchanged = await request.get(`${upstreamOrigin}/__control/campaign-analytics`);
	expect((await unchanged.json() as { requests: unknown[] }).requests).toHaveLength(4);
	await request.post(`${upstreamOrigin}/__control/reset`);
});

test('campaign test-send resolves one eligible subscriber and never retries an ambiguous v6.2 request', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'Deterministic campaign test-send assertions require the local fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await request.post(`${upstreamOrigin}/__control/campaign-messenger?id=21&messenger=email-primary`);
	await page.setExtraHTTPHeaders({ 'x-forwarded-for': `127.0.0.${68 + testInfo.retry}` });
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
	const acceptedStatus = section.getByRole('status').filter({ hasText: 'request accepted for ada.supporter@example.test. Delivery is not confirmed.' });
	await expect(acceptedStatus).toHaveCount(1);
	await expectNoSeriousAccessibilityViolations(page);

	let testSendState = await request.get(`${upstreamOrigin}/__control/campaign-test-sends`);
	let testSendRequests = (await testSendState.json() as {
		requests: Array<{ campaignId: number; payload: Record<string, unknown> }>;
	}).requests;
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
	expect((await testSendState.json() as { requests: unknown[] }).requests).toHaveLength(1);

	await page.reload();
	const refreshedSection = page.getByRole('region', { name: 'Send campaign test' });
	await refreshedSection.getByRole('button', { name: 'Choose campaign' }).click();
	await refreshedSection.getByLabel('Draft campaign').selectOption('21');
	await request.post(`${upstreamOrigin}/__control/touch-campaign?id=21`);
	await refreshedSection.getByRole('button', { name: 'Review test email' }).click();
	dialog = page.getByRole('dialog', { name: 'Send real test email?' });
	await dialog.getByRole('button', { name: 'Queue test email' }).click();
	await expect(dialog.getByRole('alert')).toContainText('campaign changed after you opened it');
	testSendState = await request.get(`${upstreamOrigin}/__control/campaign-test-sends`);
	expect((await testSendState.json() as { requests: unknown[] }).requests).toHaveLength(1);

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
	expect((await testSendState.json() as { requests: unknown[] }).requests).toHaveLength(1);

	await request.post(`${upstreamOrigin}/__control/campaign-test-send-outcome?outcome=ambiguous`);
	await dialog.getByRole('button', { name: 'Queue test email' }).click();
	const ambiguousError = dialog.getByRole('alert');
	await expect(ambiguousError).toContainText('may have queued this test email');
	await expect(ambiguousError).toContainText('Wait and check the inbox before trying again');
	await expect(ambiguousError).not.toContainText('fixture confidential campaign test-send diagnostic');
	testSendState = await request.get(`${upstreamOrigin}/__control/campaign-test-sends`);
	testSendRequests = (await testSendState.json() as { requests: Array<{ campaignId: number; payload: Record<string, unknown> }> }).requests;
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
	const nonEmailSection = page.getByRole('region', { name: 'Send campaign test' });
	await nonEmailSection.getByRole('button', { name: 'Choose campaign' }).click();
	await expect(nonEmailSection.getByText('No ordinary draft email campaigns are available.')).toBeVisible();
});

test('campaign test-send honors permissions split across assigned roles', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'The split-role operator is a local disposable fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({ 'x-forwarded-for': `127.0.0.${69 + testInfo.retry}` });
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
	expect((await testSendState.json() as { requests: unknown[] }).requests).toHaveLength(1);
});

test('subscribers use bounded server pages and preserve provider-owned identity and consent state', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'Deterministic subscriber assertions require the local fixture.');
	test.setTimeout(90_000);
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({ 'x-forwarded-for': `127.0.0.${62 + testInfo.retry}` });
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await page.getByLabel('Primary navigation').getByRole('link', { name: 'Email' }).click();
	await page.getByLabel('Email management').getByRole('link', { name: 'Subscribers' }).click();
	await expect(page).toHaveURL(/\/emails\/subscribers$/);
	const table = page.getByRole('table', { name: 'Subscribers in fixed provider order' });
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
	await search.fill('regex+literal@example.test');
	await page.getByRole('button', { name: 'Search' }).click();
	await expect(page).toHaveURL(/search=regex%2Bliteral%40example\.test/);
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
	let providerSubscribers = (await subscriberState.json() as { subscribers: Array<Record<string, unknown>>; optInRequests: Array<Record<string, unknown>> }).subscribers;
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
	providerSubscribers = (await subscriberState.json() as { subscribers: Array<Record<string, unknown>> }).subscribers;
	ada = providerSubscribers.find(({ id }) => id === 158);
	const adaMemberships = ada?.['lists'] as Array<Record<string, unknown>>;
	expect(adaMemberships.find(({ id }) => id === 12)).toMatchObject({
		subscription_status: 'unsubscribed',
		subscription_meta: { coordinator: 'Sam' },
	});
	await expect(page.getByRole('heading', { name: 'Provider- or consent-protected memberships' })).toBeVisible();

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
	let createdState = await subscriberState.json() as { subscribers: Array<Record<string, unknown>>; optInRequests: Array<Record<string, unknown>> };
	expect(createdState.optInRequests).not.toContainEqual(expect.objectContaining({ subscriberId: 159 }));
	expect(createdState.subscribers.find(({ id }) => id === 159)?.['lists']).toEqual([
		expect.objectContaining({ id: 11, subscription_status: 'unconfirmed' }),
	]);
	await page.getByRole('button', { name: 'Request confirmation' }).click();
	const optInDialog = page.getByRole('dialog', { name: 'Request confirmation?' });
	await expect(optInDialog).toContainText('Acceptance does not prove that email delivery completed.');
	await optInDialog.getByRole('button', { name: 'Request confirmation' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Opt-in request accepted.' })).toBeVisible();
	subscriberState = await request.get(`${upstreamOrigin}/__control/subscribers`);
	createdState = await subscriberState.json() as { subscribers: Array<Record<string, unknown>>; optInRequests: Array<Record<string, unknown>> };
	const finalState = createdState;
	expect(finalState.optInRequests).toContainEqual(expect.objectContaining({ subscriberId: 159 }));
	expect(finalState.subscribers.find(({ id }) => id === 159)?.['lists']).toEqual([
		expect.objectContaining({ id: 11, subscription_status: 'unconfirmed' }),
	]);

	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await page.getByRole('dialog', { name: 'Delete subscriber?' }).getByRole('button', { name: 'Delete subscriber' }).click();
	await expect(page).toHaveURL(/\/emails\/subscribers$/);
	await expect(page.getByRole('link', { name: 'phase-review-subscriber@example.test' })).toHaveCount(0);
	await request.post(`${upstreamOrigin}/__control/reset`);
});

test('subscriber-only reads never serialize mailing-list or campaign metadata', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'The subscriber-only role is a local disposable fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({ 'x-forwarded-for': `127.0.0.${63 + testInfo.retry}` });
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
	await page.setExtraHTTPHeaders({ 'x-forwarded-for': `127.0.0.${66 + testInfo.retry}` });
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await page.getByLabel('Primary navigation').getByRole('link', { name: 'Email' }).click();
	await page.getByLabel('Email management').getByRole('link', { name: 'Bounces' }).click();
	const table = page.getByRole('table', { name: 'Bounce records in newest-first provider order' });
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
	const selectedDialog = page.getByRole('dialog', { name: 'Clear selected bounce records?' });
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
	const subscriberTable = page.getByRole('table', { name: 'Bounce history for ada.supporter@example.test' });
	await expect(subscriberTable.locator('tbody tr')).toHaveCount(1);
	await page.getByRole('button', { name: 'Clear subscriber bounce history' }).click();
	const subscriberDialog = page.getByRole('dialog', { name: 'Clear subscriber bounce history?' });
	await subscriberDialog.getByRole('button', { name: 'Clear bounce history' }).click();
	await expect(subscriberTable.getByText('No bounce records for this subscriber.')).toBeVisible();
	await expect.poll(async () => (await (await request.get(`${upstreamOrigin}/__control/bounces`)).json()).bounces.filter((bounce: { subscriber_id: number }) => bounce.subscriber_id === 158).length).toBe(0);

	await page.goto('/emails/bounces');
	await page.getByRole('button', { name: 'Clear all bounce records' }).click();
	const allDialog = page.getByRole('dialog', { name: 'Clear all bounce records?' });
	await allDialog.getByRole('button', { name: 'Clear all bounce records' }).click();
	await expect(table.getByText('No bounce records are available.')).toBeVisible();
	await expect.poll(async () => (await (await request.get(`${upstreamOrigin}/__control/bounces`)).json()).bounces.length).toBe(0);
	await expectNoSeriousAccessibilityViolations(page);
	await request.post(`${upstreamOrigin}/__control/reset`);
});

test('a campaign-view-only role lands on campaigns without advertising mutations', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'The campaign-only role is a local disposable fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({ 'x-forwarded-for': `127.0.0.${61 + testInfo.retry}` });
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

test('a bounce-view-only role lands on bounded bounce history without clear controls', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'The bounce-only role is a local disposable fixture.');
	await request.post(`${upstreamOrigin}/__control/reset`);
	await page.setExtraHTTPHeaders({ 'x-forwarded-for': `127.0.0.${65 + testInfo.retry}` });
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
	const table = page.getByRole('table', { name: 'Bounce records in newest-first provider order' });
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
	const alternateId = (await alternate.json() as { data: { id: number } }).data.id;
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
	await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
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

test('access management is route-based, keyboard-operable, private, and preserves user identities', async ({ page, request }, testInfo) => {
	test.skip(!!process.env['ADMIN_V2_PRODUCTION_E2E_BASE_URL'], 'Deterministic access assertions require the local fixture.');
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${70 + testInfo.retry}`,
	});
	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

	const navigation = page.getByLabel('Primary navigation');
	await expect(navigation.getByRole('link', { name: 'Roles' })).toBeVisible();
	await expect(navigation.getByRole('link', { name: 'Members' })).toBeVisible();
	await navigation.getByRole('link', { name: 'Roles' }).click();
	await expect(page.getByRole('heading', { name: 'Roles and permissions' })).toBeVisible();
	await expect(page.getByRole('table', { name: 'Organization roles' })).toBeVisible();
	await expectNoSeriousAccessibilityViolations(page);

	await page.getByRole('link', { name: 'New role' }).click();
	await expect(page.getByRole('heading', { name: 'New role' })).toBeVisible();
	await page.getByLabel('Role key').fill(` ${accessRole.toUpperCase()} `);
	const analyticsView = page.getByRole('group', { name: 'Analytics' }).getByLabel('View');
	await analyticsView.focus();
	await page.keyboard.press('Space');
	await expect(analyticsView).toBeChecked();
	await expectNoSeriousAccessibilityViolations(page);
	await page.getByRole('button', { name: 'Create role' }).click();
	await expect(page).toHaveURL(/\/roles$/);
	await expect(page.getByRole('status').filter({ hasText: `Role ${accessRole} created.` })).toBeVisible();

	const filter = page.getByLabel('Filter roles');
	await filter.focus();
	await page.keyboard.type(accessRole);
	await expect(page.getByRole('link', { name: accessRole, exact: true })).toBeVisible();
	await page.getByRole('link', { name: accessRole, exact: true }).click();
	await expect(page.getByRole('heading', { name: accessRole })).toBeVisible();
	await expect(page.getByLabel('Role key')).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Delete role' })).toHaveCount(0);
	await expect(page.getByText('To retire this role')).toBeVisible();
	await expectNoSeriousAccessibilityViolations(page);

	for (const path of [
		'/api/auth/organization/create-role',
		'/api/auth/organization/update-role',
		'/api/auth/organization/delete-role',
		'/api/auth/organization/invite-member',
		'/api/auth/organization/update-member-role',
		'/api/auth/organization/remove-member',
		'/api/auth/organization/cancel-invitation',
		'/api/auth/organization/leave',
	]) {
		const response = await request.post(path, { data: {} });
		expect(response.status(), path).toBe(404);
	}

	await navigation.getByRole('link', { name: 'Members' }).click();
	await expect(page.getByRole('heading', { name: 'Members', exact: true })).toBeVisible();
	await expect(
		page.getByRole('table', {
			name: 'Organization members and assigned roles',
		}),
	).toBeVisible();
	await expectNoSeriousAccessibilityViolations(page);

	const accessMemberRow = page.getByRole('row').filter({ hasText: accessEmail });
	await accessMemberRow.getByRole('link', { name: 'Edit roles' }).click();
	await expect(page.getByRole('heading', { name: 'Roles for Access Target' })).toBeVisible();
	await page.getByRole('group', { name: 'Roles' }).getByLabel(accessRole).check();
	await page.getByRole('button', { name: 'Save roles' }).click();
	await expect(page).toHaveURL(/\/members$/);
	await expect(page.getByRole('row').filter({ hasText: accessEmail })).toContainText(accessRole);

	await page.getByRole('link', { name: 'Invite member' }).click();
	await expect(page.getByRole('heading', { name: 'Invite member' })).toBeVisible();
	await page.getByLabel('Email').fill(accessInvitationEmail);
	await page.getByRole('group', { name: 'Roles' }).getByLabel(accessRole).check();
	await expectNoSeriousAccessibilityViolations(page);
	await page.getByRole('button', { name: 'Send invitation' }).click();
	await expect(page).toHaveURL(/\/members$/);
	const invitationRow = page.getByRole('row').filter({ hasText: accessInvitationEmail });
	await expect(invitationRow).toContainText(accessRole);

	const cancelInvitationButton = invitationRow.getByRole('button', {
		name: 'Cancel',
	});
	await cancelInvitationButton.click();
	const cancelDialog = page.getByRole('dialog', { name: 'Cancel invitation?' });
	await expect(cancelDialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(cancelInvitationButton).toBeFocused();
	await cancelInvitationButton.click();
	await cancelDialog.getByRole('button', { name: 'Cancel invitation' }).click();
	await expect(page.getByText(accessInvitationEmail)).toHaveCount(0);

	const removeMemberButton = page.getByRole('row').filter({ hasText: accessEmail }).getByRole('button', { name: 'Remove' });
	await removeMemberButton.click();
	const removeDialog = page.getByRole('dialog', { name: 'Remove member?' });
	await expect(removeDialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
	await removeDialog.getByRole('button', { name: 'Remove member' }).click();
	await expect(page.getByText(accessEmail)).toHaveCount(0);

	const preservedIdentity = await fixturePool?.query<{
		users: number;
		accounts: number;
		memberships: number;
	}>(
		`SELECT
			(SELECT COUNT(*)::int FROM "user" WHERE id = $1) AS users,
			(SELECT COUNT(*)::int FROM account WHERE "userId" = $1) AS accounts,
			(SELECT COUNT(*)::int FROM member WHERE "userId" = $1) AS memberships`,
		[accessUserId],
	);
	expect(preservedIdentity?.rows[0]).toEqual({
		users: 1,
		accounts: 1,
		memberships: 0,
	});

	await navigation.getByRole('link', { name: 'Roles' }).click();
	await page.getByLabel('Filter roles').fill(accessRole);
	await page.getByRole('link', { name: accessRole, exact: true }).click();
	await page.getByRole('group', { name: 'Analytics' }).getByLabel('View').uncheck();
	await page.getByRole('button', { name: 'Save permissions' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Role permissions updated.' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Delete role' })).toHaveCount(0);
});

test('live invitations stay private, preserve wrong-account recovery, and accept durably', async ({ page }, testInfo) => {
	await page.setExtraHTTPHeaders({
		'x-forwarded-for': `127.0.0.${20 + testInfo.retry}`,
	});
	const serverPayloads: Array<Promise<string>> = [];
	page.on('response', (response) => {
		if (new URL(response.url()).pathname === '/_server') serverPayloads.push(response.text().catch(() => ''));
	});

	await page.goto(`/members/accept/${redactedInvitationId}`);
	await expect(page.getByRole('heading', { name: 'Verify your invitation' })).toBeVisible();
	const anonymousText = await page.locator('body').innerText();
	expect(anonymousText).not.toContain('private-pending-invite@example.test');
	expect(anonymousText).not.toContain(canonicalOrganizationName);
	expect((await Promise.all(serverPayloads)).join('\n')).not.toContain('private-pending-invite@example.test');

	await page.goto(`/members/accept/${canceledInvitationId}`);
	await expect(page.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible();
	await expect(page.getByText('This invitation has been cancelled.')).toBeVisible();
	await expect(page.getByText('private-canceled-invite@example.test')).toHaveCount(0);

	await page.goto('/login');
	await page.getByLabel('Email').fill(ownerEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

	const invitationPath = `/members/accept/${acceptedInvitationId}`;
	await page.goto(invitationPath);
	await expect(page.getByRole('heading', { name: 'Wrong account' })).toBeVisible();
	await page.getByRole('button', { name: 'Sign out and continue' }).click();
	await expect(page).toHaveURL(new RegExp(`${invitationPath}$`));
	await expect(page.getByRole('heading', { name: 'Verify your invitation' })).toBeVisible();

	await page.goto('/login');
	await page.getByLabel('Email').fill(invitedEmail);
	await page.getByLabel('Password').fill(ownerPassword);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('alert')).toContainText('Signed in, but this account could not access the organization.');

	await page.goto(invitationPath);
	await expect(page.getByRole('heading', { name: 'Accept invitation' })).toBeVisible();
	await expect(page.getByText(canonicalOrganizationName, { exact: false })).toBeVisible();
	await page.getByRole('button', { name: 'Accept Invitation' }).click();
	await expect(page.getByRole('heading', { name: 'Welcome!' })).toBeVisible();

	const durableState = await fixturePool?.query<{
		activeOrganizationId: string | null;
		memberCount: string;
		memberRole: string | null;
		status: string;
	}>(
		`SELECT i.status,
		        (SELECT COUNT(*)::text FROM member m WHERE m."organizationId" = $1 AND m."userId" = $2) AS "memberCount",
		        (SELECT m.role FROM member m WHERE m."organizationId" = $1 AND m."userId" = $2) AS "memberRole",
		        (SELECT s."activeOrganizationId" FROM session s WHERE s."userId" = $2 ORDER BY s."createdAt" DESC LIMIT 1) AS "activeOrganizationId"
		 FROM invitation i WHERE i.id = $3`,
		[canonicalOrganizationId, invitedUserId, acceptedInvitationId],
	);
	expect(durableState?.rows[0]).toEqual({
		activeOrganizationId: canonicalOrganizationId,
		memberCount: '1',
		memberRole: deniedRole,
		status: 'accepted',
	});

	await page.getByRole('button', { name: 'Go to Dashboard' }).click();
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	await page.goto(invitationPath);
	await expect(page.getByText('This invitation has already been accepted.')).toBeVisible();

	await fixturePool?.query('DELETE FROM member WHERE "organizationId" = $1 AND "userId" = $2', [canonicalOrganizationId, invitedUserId]);
	await page.reload();
	await expect(page.getByText('This invitation has already been accepted.')).toBeVisible();
	const restoredMembership = await fixturePool?.query<{ count: string }>(
		'SELECT COUNT(*)::text AS count FROM member WHERE "organizationId" = $1 AND "userId" = $2',
		[canonicalOrganizationId, invitedUserId],
	);
	expect(restoredMembership?.rows[0]?.count).toBe('0');
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
