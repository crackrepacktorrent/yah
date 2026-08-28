import {
	expect,
	test,
	acceptedInvitationId,
	accessEmail,
	accessInvitationEmail,
	accessRole,
	accessUserId,
	canceledInvitationId,
	canonicalOrganizationId,
	canonicalOrganizationName,
	deniedRole,
	expectNoSeriousAccessibilityViolations,
	fixturePool,
	invitedEmail,
	invitedUserId,
	ownerEmail,
	ownerPassword,
	redactedInvitationId,
} from '../production-test';

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

	await expect(page.getByRole('searchbox')).toHaveCount(0);
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
	await expect(page.getByRole('status').filter({ hasText: 'Invitation sent.' })).toBeVisible();

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
	const restoredMembership = await fixturePool?.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM member WHERE "organizationId" = $1 AND "userId" = $2', [
		canonicalOrganizationId,
		invitedUserId,
	]);
	expect(restoredMembership?.rows[0]?.count).toBe('0');
});
