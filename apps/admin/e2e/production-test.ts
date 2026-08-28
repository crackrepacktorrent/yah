import AxeBuilder from '@axe-core/playwright';
import { expect, test as base, type Page } from '@playwright/test';

export { expect };
import { Pool } from 'pg';
import { requireDisposableProductionE2EDatabase } from './production-environment';

export const productionOrigin = process.env['ADMIN_PRODUCTION_E2E_BASE_URL'] ?? 'http://127.0.0.1:43123';
export const upstreamOrigin = 'http://127.0.0.1:43124';
export const ownerEmail = 'owner-one@example.test';
export const ownerPassword = 'owner-one-test-password-2026';
export const invitedEmail = 'invited-member@example.test';
export const invitedUserId = 'admin-e2e-invited-user';
export const invitedAccountId = 'admin-e2e-invited-account';
export const deniedEmail = 'no-analytics@example.test';
export const deniedUserId = 'admin-e2e-no-analytics-user';
export const deniedAccountId = 'admin-e2e-no-analytics-account';
export const deniedMemberId = 'admin-e2e-no-analytics-member';
export const deniedRoleId = 'admin-e2e-no-analytics-role';
export const deniedRole = 'admin-no-analytics';
export const listOnlyEmail = 'list-reader@example.test';
export const listOnlyUserId = 'admin-e2e-list-reader-user';
export const listOnlyAccountId = 'admin-e2e-list-reader-account';
export const listOnlyMemberId = 'admin-e2e-list-reader-member';
export const listOnlyRoleId = 'admin-e2e-list-reader-role';
export const listOnlyRole = 'admin-list-reader';
export const subscriberOnlyEmail = 'subscriber-reader@example.test';
export const subscriberOnlyUserId = 'admin-e2e-subscriber-reader-user';
export const subscriberOnlyAccountId = 'admin-e2e-subscriber-reader-account';
export const subscriberOnlyMemberId = 'admin-e2e-subscriber-reader-member';
export const subscriberOnlyRoleId = 'admin-e2e-subscriber-reader-role';
export const subscriberOnlyRole = 'admin-subscriber-reader';
export const splitTestSendEmail = 'split-test-send@example.test';
export const splitTestSendUserId = 'admin-e2e-split-test-send-user';
export const splitTestSendAccountId = 'admin-e2e-split-test-send-account';
export const splitTestSendMemberId = 'admin-e2e-split-test-send-member';
export const splitTestSendCampaignRoleId = 'admin-e2e-split-test-send-campaign-role';
export const splitTestSendCampaignRole = 'admin-split-test-send-campaign';
export const campaignOnlyEmail = 'campaign-reader@example.test';
export const campaignOnlyUserId = 'admin-e2e-campaign-reader-user';
export const campaignOnlyAccountId = 'admin-e2e-campaign-reader-account';
export const campaignOnlyMemberId = 'admin-e2e-campaign-reader-member';
export const campaignOnlyRoleId = 'admin-e2e-campaign-reader-role';
export const campaignOnlyRole = 'admin-campaign-reader';
export const bounceOnlyEmail = 'bounce-reader@example.test';
export const bounceOnlyUserId = 'admin-e2e-bounce-reader-user';
export const bounceOnlyAccountId = 'admin-e2e-bounce-reader-account';
export const bounceOnlyMemberId = 'admin-e2e-bounce-reader-member';
export const bounceOnlyRoleId = 'admin-e2e-bounce-reader-role';
export const bounceOnlyRole = 'admin-bounce-reader';
export const isolatedEmail = 'shortlink-editor@example.test';
export const isolatedUserId = 'admin-e2e-shortlink-editor-user';
export const isolatedAccountId = 'admin-e2e-shortlink-editor-account';
export const isolatedMemberId = 'admin-e2e-shortlink-editor-member';
export const isolatedRoleId = 'admin-e2e-shortlink-editor-role';
export const isolatedRole = 'admin-shortlink-editor';
export const accessUserId = 'admin-e2e-access-target';
export const accessAccountId = 'admin-e2e-access-target-account';
export const accessMemberId = 'admin-e2e-access-target-member';
export const accessEmail = 'access-target@example.test';
export const accessInvitationEmail = 'access-invitation@example.test';
export const accessRole = 'e2e-access-reviewer';
export const redactedInvitationId = 'admin-e2e-redacted-invitation';
export const canceledInvitationId = 'admin-e2e-canceled-invitation';
export const acceptedInvitationId = 'admin-e2e-accepted-invitation';
export const fixtureInvitationIds = [redactedInvitationId, canceledInvitationId, acceptedInvitationId];

export let fixturePool: Pool | undefined;
export let canonicalOrganizationId = '';
export let canonicalOrganizationName = '';
let ownerUserId = '';
let originalOwnerSessionIds: string[] = [];

export async function expectNoSeriousAccessibilityViolations(page: Page, excludedSelectors: string[] = []): Promise<void> {
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

export async function softNavigate(page: Page, href: string): Promise<void> {
	await page.evaluate((target) => {
		window.history.pushState(null, '', target);
		window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
	}, href);
}

export async function expectSelectedEmailSection(page: Page, name: string): Promise<void> {
	const navigation = page.getByLabel('Email management');
	await expect(navigation.locator('a[aria-current="page"]')).toHaveCount(1);
	await expect(navigation.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
}

export async function expectSelectedPrimarySection(page: Page, name: string): Promise<void> {
	const navigation = page.getByLabel('Primary navigation');
	await expect(navigation.locator('a[data-active]')).toHaveCount(1);
	await expect(navigation.getByRole('link', { name, exact: true })).toHaveAttribute('data-active');
}

export async function expectNoDocumentOverflow(page: Page): Promise<void> {
	const report = await page.evaluate(() => {
		const viewportWidth = document.documentElement.clientWidth;
		return {
			documentWidth: document.documentElement.scrollWidth,
			viewportWidth,
			offenders: [...document.querySelectorAll<HTMLElement>('body *')]
				.map((element) => {
					const bounds = element.getBoundingClientRect();
					return {
						left: Math.round(bounds.left),
						right: Math.round(bounds.right),
						selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${[...element.classList].map((name) => `.${name}`).join('')}`,
					};
				})
				.filter(({ right }) => right > viewportWidth + 1)
				.slice(0, 12),
		};
	});
	expect(report.documentWidth, JSON.stringify(report.offenders)).toBeLessThanOrEqual(report.viewportWidth);
}

async function setupProductionDatabase(): Promise<void> {
	fixturePool = new Pool({
		connectionString: requireDisposableProductionE2EDatabase(),
	});
	const client = await fixturePool.connect();
	try {
		await client.query('BEGIN');
		await client.query("SET LOCAL yah.allow_test_role_delete = 'on'");
		await client.query('DELETE FROM invitation WHERE id = ANY($1::text[]) OR email = $2', [fixtureInvitationIds, accessInvitationEmail]);
		await client.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
			[invitedUserId, deniedUserId, listOnlyUserId, subscriberOnlyUserId, splitTestSendUserId, campaignOnlyUserId, bounceOnlyUserId, isolatedUserId, accessUserId],
		]);
		await client.query('DELETE FROM "organizationRole" WHERE id = ANY($1::text[]) OR role = $2', [
			[deniedRoleId, listOnlyRoleId, subscriberOnlyRoleId, splitTestSendCampaignRoleId, campaignOnlyRoleId, bounceOnlyRoleId, isolatedRoleId],
			accessRole,
		]);

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
				JSON.stringify({
					shortlink: ['view'],
					template: ['view', 'set-default'],
					list: ['view'],
				}),
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
}

async function cleanupProductionDatabase(): Promise<void> {
	if (!fixturePool) return;
	const client = await fixturePool.connect();
	try {
		if (ownerUserId) {
			await client.query('DELETE FROM session WHERE "userId" = $1 AND NOT (id = ANY($2::text[]))', [ownerUserId, originalOwnerSessionIds]);
		}
		await client.query('BEGIN');
		await client.query("SET LOCAL yah.allow_test_role_delete = 'on'");
		await client.query('DELETE FROM invitation WHERE id = ANY($1::text[]) OR email = $2', [fixtureInvitationIds, accessInvitationEmail]);
		await client.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
			[invitedUserId, deniedUserId, listOnlyUserId, subscriberOnlyUserId, splitTestSendUserId, campaignOnlyUserId, bounceOnlyUserId, isolatedUserId, accessUserId],
		]);
		await client.query('DELETE FROM "organizationRole" WHERE id = ANY($1::text[]) OR role = $2', [
			[deniedRoleId, listOnlyRoleId, subscriberOnlyRoleId, splitTestSendCampaignRoleId, campaignOnlyRoleId, bounceOnlyRoleId, isolatedRoleId],
			accessRole,
		]);
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK').catch(() => undefined);
		throw error;
	} finally {
		client.release();
		await fixturePool.end();
	}
}

type ProductionWorkerFixtures = { productionDatabase: void };

export const test = base.extend<{}, ProductionWorkerFixtures>({
	productionDatabase: [
		async ({ browserName }, use) => {
			void browserName;
			await setupProductionDatabase();
			try {
				await use();
			} finally {
				await cleanupProductionDatabase();
			}
		},
		{ auto: true, scope: 'worker' },
	],
});
