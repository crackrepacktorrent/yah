import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const integrationRequested = process.env['ADMIN_V2_AUTH_INTEGRATION'] === '1';
const integrationConfirmation = 'mutate-and-clean-disposable-auth-database';

if (integrationRequested) {
	if (process.env['ADMIN_V2_AUTH_INTEGRATION_CONFIRMATION'] !== integrationConfirmation) {
		throw new Error(`Production auth integration requires ADMIN_V2_AUTH_INTEGRATION_CONFIRMATION=${integrationConfirmation}.`);
	}

	const databaseUrl = process.env['DATABASE_URL'];
	if (!databaseUrl) throw new Error('Production auth integration requires DATABASE_URL.');
	let databaseName: string;
	try {
		const parsed = new URL(databaseUrl);
		databaseName = decodeURIComponent(parsed.pathname.slice(1));
	} catch {
		throw new Error('Production auth integration requires a valid DATABASE_URL.');
	}
	if (!databaseName.endsWith('_test')) {
		throw new Error('Production auth integration refuses a database whose name does not end in _test.');
	}
}

const enabled = integrationRequested;
const origin = process.env['BETTER_AUTH_URL'] ?? 'http://127.0.0.1:43123';
const fixturePassword = 'owner-one-test-password-2026';
const sourceOwnerEmail = 'owner-one@example.test';
const fixture = {
	userId: 'admin-v2-integration-member',
	accountId: 'admin-v2-integration-member-account',
	memberId: 'admin-v2-integration-member-membership',
	email: 'admin-v2-member@example.test',
	nonMemberUserId: 'admin-v2-integration-nonmember',
	nonMemberAccountId: 'admin-v2-integration-nonmember-account',
	nonMemberEmail: 'admin-v2-nonmember@example.test',
	unverifiedUserId: 'admin-v2-integration-unverified',
	unverifiedAccountId: 'admin-v2-integration-unverified-account',
	unverifiedEmail: 'admin-v2-unverified@example.test',
	roleId: 'admin-v2-integration-reviewer-role',
	role: 'admin-v2-reviewer',
	racingRoleId: 'admin-v2-integration-race-role',
	racingRole: 'admin-v2-race-role',
	racingInvitationId: 'admin-v2-integration-race-invitation',
	uniqueRole: 'admin-v2-concurrent-role',
} as const;

type ProductionRuntime = typeof import('./production-server');
type AuthorizationRuntime = typeof import('./authorization.server');

let production: ProductionRuntime;
let authorization: AuthorizationRuntime;

async function removeFixtures(): Promise<void> {
	await production.pool.query('DELETE FROM invitation WHERE id = $1', [fixture.racingInvitationId]);
	await production.pool.query('DELETE FROM "user" WHERE id = ANY($1)', [
		[fixture.userId, fixture.nonMemberUserId, fixture.unverifiedUserId],
	]);
	const client = await production.pool.connect();
	try {
		await client.query('BEGIN');
		await client.query("SET LOCAL yah.allow_test_role_delete = 'on'");
		await client.query(
			'DELETE FROM "organizationRole" WHERE id = ANY($1::text[]) OR ("organizationId" = $2 AND role = $3)',
			[[fixture.roleId, fixture.racingRoleId], production.canonicalOrganizationId, fixture.uniqueRole],
		);
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK').catch(() => undefined);
		throw error;
	} finally {
		client.release();
	}
}

async function cloneCredentialUser(input: { id: string; accountId: string; email: string; verified: boolean }): Promise<void> {
	await production.pool.query(
		`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
		 VALUES ($1, 'Solid 2 integration fixture', $2, $3, NOW(), NOW())`,
		[input.id, input.email, input.verified],
	);
	await production.pool.query(
		`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
		 SELECT $1, $2, 'credential', $3, source.password, NOW(), NOW()
		 FROM account source
		 JOIN "user" owner_user ON owner_user.id = source."userId"
		 WHERE owner_user.email = $4 AND source."providerId" = 'credential' AND source.password IS NOT NULL`,
		[input.accountId, input.id, input.id, sourceOwnerEmail],
	);
}

async function post(path: string, body: unknown, cookie?: string): Promise<Response> {
	const headers = new Headers({
		'content-type': 'application/json',
		origin,
	});
	if (cookie) headers.set('cookie', cookie);
	return production.auth.handler(
		new Request(new URL(`/api/auth${path}`, origin), {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		}),
	);
}

async function login(email: string): Promise<{ response: Response; cookie: string | null }> {
	const response = await post('/sign-in/email', { email, password: fixturePassword });
	const setCookie = response.headers.get('set-cookie');
	return { response, cookie: setCookie?.split(';', 1)[0] ?? null };
}

describe.skipIf(!enabled)('production auth and canonical authorization', () => {
	beforeAll(async () => {
		production = await import('./production-server');
		authorization = await import('./authorization.server');
		await removeFixtures();

		await cloneCredentialUser({
			id: fixture.userId,
			accountId: fixture.accountId,
			email: fixture.email,
			verified: true,
		});
		await cloneCredentialUser({
			id: fixture.nonMemberUserId,
			accountId: fixture.nonMemberAccountId,
			email: fixture.nonMemberEmail,
			verified: true,
		});
		await cloneCredentialUser({
			id: fixture.unverifiedUserId,
			accountId: fixture.unverifiedAccountId,
			email: fixture.unverifiedEmail,
			verified: false,
		});

		await production.pool.query(
			`INSERT INTO "organizationRole" (id, "organizationId", role, permission, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
			[
				fixture.roleId,
				production.canonicalOrganizationId,
				fixture.role,
				JSON.stringify({ settings: ['edit'] }),
			],
		);
		await production.pool.query(
			`INSERT INTO member (id, "organizationId", "userId", role, "createdAt")
			 VALUES ($1, $2, $3, $4, NOW())`,
			[fixture.memberId, production.canonicalOrganizationId, fixture.userId, `member,${fixture.role}`],
		);
	}, 30_000);

	afterAll(async () => {
		if (!production) return;
		await removeFixtures();
		await production.pool.end();
	});

	it('projects multi-role permissions while Better Auth remains the command authority', async () => {
		const signedIn = await login(fixture.email);
		expect(signedIn.response.status).toBe(200);
		expect(signedIn.cookie).not.toBeNull();
		const cookie = signedIn.cookie!;

		const active = await post('/organization/set-active', { organizationSlug: 'yah' }, cookie);
		expect(active.status).toBe(200);

		const headers = new Headers({ cookie });
		const projected = await authorization.projectSession(headers);
		expect(projected).toMatchObject({
			authorized: true,
			roles: ['member', fixture.role],
		});
		expect(projected?.permissions['settings']).toContain('edit');
		expect(projected?.permissions['provider']).toBeUndefined();
		expect(projected?.permissions['analytics']).toContain('view');

		await expect(authorization.enforcePermissions(headers, { settings: ['edit'] })).resolves.toBeUndefined();
		await expect(authorization.enforcePermissions(headers, { provider: ['manage'] })).rejects.toMatchObject({ status: 403 });
		await expect(authorization.enforcePermissions(headers, { settings: ['edit'], analytics: ['view'] })).resolves.toBeUndefined();
		await expect(authorization.enforcePermissions(headers, { member: ['delete'] })).rejects.toMatchObject({ status: 403 });
	});

	it('rejects a verified session that lacks canonical membership', async () => {
		const signedIn = await login(fixture.nonMemberEmail);
		expect(signedIn.response.status).toBe(200);
		const cookie = signedIn.cookie!;
		const headers = new Headers({ cookie });
		const session = await production.auth.api.getSession({ headers });
		expect(session).not.toBeNull();
		await production.pool.query('UPDATE session SET "activeOrganizationId" = $1 WHERE id = $2', [
			production.canonicalOrganizationId,
			session!.session.id,
		]);

		expect(await authorization.projectSession(headers)).toMatchObject({ authorized: false, roles: [] });
		await expect(authorization.requireCanonicalSession(headers)).rejects.toMatchObject({ status: 403 });
	});

	it('does not mint a session for an unverified password account', async () => {
		const signedIn = await login(fixture.unverifiedEmail);
		expect(signedIn.response.status).toBeGreaterThanOrEqual(400);
		expect(signedIn.cookie).toBeNull();
	});

	it('maps concurrent custom-role creates to one stable key conflict', async () => {
		const { createProductionRoleDirectory } = await import('./role-directory.server');
		const directory = createProductionRoleDirectory(new Headers());
		const attempts = await Promise.allSettled([
			directory.createCustomRole(fixture.uniqueRole, { analytics: ['view'] }),
			directory.createCustomRole(fixture.uniqueRole, { analytics: ['view'] }),
		]);
		expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
		const rejected = attempts.find((attempt) => attempt.status === 'rejected');
		expect(rejected).toMatchObject({
			status: 'rejected',
			reason: { name: 'RoleDirectoryFailure', reason: 'key-conflict' },
		});
	});

	it('enforces canonical custom-role keys and known assignments at the database boundary', async () => {
		await expect(
			production.pool.query(
				`INSERT INTO "organizationRole" (id, "organizationId", role, permission, "createdAt", "updatedAt")
				 VALUES ($1, $2, 'Not-Canonical', '{}', NOW(), NOW())`,
				[fixture.racingRoleId, production.canonicalOrganizationId],
			),
		).rejects.toMatchObject({ code: '23514', constraint: 'yah_organization_role_key' });

		await expect(
			production.pool.query(
				`INSERT INTO invitation (id, "organizationId", email, role, status, "expiresAt", "createdAt", "inviterId")
				 VALUES ($1, $2, 'unknown-role@example.test', 'missing-role', 'pending', NOW() + INTERVAL '1 day', NOW(), $3)`,
				[fixture.racingInvitationId, production.canonicalOrganizationId, fixture.userId],
			),
		).rejects.toMatchObject({ code: '23503', constraint: 'yah_known_organization_role' });
	});

	it('retires custom roles instead of allowing physical deletion', async () => {
		await production.pool.query(
			`INSERT INTO "organizationRole" (id, "organizationId", role, permission, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, '{}', NOW(), NOW())`,
			[fixture.racingRoleId, production.canonicalOrganizationId, fixture.racingRole],
		);
		await expect(
			production.pool.query(
				`UPDATE "organizationRole" SET role = $3
				 WHERE "organizationId" = $1 AND id = $2`,
				[production.canonicalOrganizationId, fixture.racingRoleId, `${fixture.racingRole}-renamed`],
			),
		).rejects.toMatchObject({ code: '55000', constraint: 'yah_organization_role_identity_immutable' });

		await expect(
			production.pool.query(
				'DELETE FROM "organizationRole" WHERE "organizationId" = $1 AND id = $2',
				[production.canonicalOrganizationId, fixture.racingRoleId],
			),
		).rejects.toMatchObject({ code: '55000', constraint: 'yah_organization_role_delete_disabled' });

		await expect(production.pool.query('TRUNCATE TABLE "organizationRole"')).rejects.toMatchObject({
			code: '55000',
			constraint: 'yah_organization_role_truncate_disabled',
		});

		await production.pool.query(
			`UPDATE "organizationRole" SET permission = '{}', "updatedAt" = NOW()
			 WHERE "organizationId" = $1 AND id = $2`,
			[production.canonicalOrganizationId, fixture.racingRoleId],
		);
		const retired = await production.pool.query<{ permission: unknown }>(
			`SELECT permission FROM "organizationRole" WHERE "organizationId" = $1 AND id = $2`,
			[production.canonicalOrganizationId, fixture.racingRoleId],
		);
		expect(retired.rows).toHaveLength(1);
	});
});
