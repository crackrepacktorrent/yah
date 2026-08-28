import { describe, expect, test } from 'bun:test';
import { betterAuth } from 'better-auth';
import { memoryAdapter, type MemoryDB } from 'better-auth/adapters/memory';
import { magicLink, organization } from 'better-auth/plugins';
import { ORG_SLUG } from '../src/lib/constants';
import {
	hashInvitationMagicLinkToken,
	INVITATION_MAGIC_LINK_EXPIRES_IN,
	invitationAuthPolicy,
} from '../src/server/invitation-auth-policy';

const origin = 'http://auth.test';
const secret = 'invitation-security-contract-secret-32-chars';
const invitationId = 'pending-invitation';
const inviteeEmail = 'invitee@example.com';

function createDatabase(): MemoryDB {
	const now = new Date();
	return {
		account: [],
		invitation: [
			{
				id: invitationId,
				organizationId: 'organization-id',
				email: inviteeEmail,
				role: 'member',
				status: 'pending',
				inviterId: 'owner-id',
				expiresAt: new Date(now.getTime() + 60_000),
				createdAt: now,
			},
		],
		member: [
			{
				id: 'owner-member-id',
				organizationId: 'organization-id',
				userId: 'owner-id',
				role: 'owner',
				createdAt: now,
			},
		],
		organization: [{ id: 'organization-id', name: 'YAH', slug: ORG_SLUG, createdAt: now }],
		session: [],
		user: [
			{
				id: 'owner-id',
				email: 'owner@example.com',
				emailVerified: true,
				name: 'Owner',
				createdAt: now,
				updatedAt: now,
			},
		],
		verification: [],
	};
}

function createProtectedAuth(database: MemoryDB) {
	const deliveries: Array<{ email: string; url: string }> = [];
	const auth = betterAuth({
		baseURL: origin,
		secret,
		database: memoryAdapter(database),
		trustedOrigins: [origin],
		emailAndPassword: {
			enabled: true,
			disableSignUp: true,
			requireEmailVerification: true,
			revokeSessionsOnPasswordReset: true,
		},
		plugins: [
			magicLink({
				disableSignUp: false,
				expiresIn: INVITATION_MAGIC_LINK_EXPIRES_IN,
				storeToken: { type: 'custom-hasher', hash: hashInvitationMagicLinkToken },
				sendMagicLink({ email, url }) {
					deliveries.push({ email, url });
				},
			}),
			organization({
				allowUserToCreateOrganization: false,
				requireEmailVerificationOnInvitation: true,
			}),
			invitationAuthPolicy(),
		],
		rateLimit: { enabled: true },
	});

	return { auth, deliveries };
}

function createPreRegistrationAuth(database: MemoryDB) {
	return betterAuth({
		baseURL: origin,
		secret,
		database: memoryAdapter(database),
		trustedOrigins: [origin],
		emailAndPassword: { enabled: true },
	});
}

async function post(
	auth: ReturnType<typeof betterAuth>,
	path: string,
	body: unknown,
	cookie?: string,
	ip = '203.0.113.10'
): Promise<Response> {
	return auth.handler(
		new Request(`${origin}/api/auth${path}`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				origin,
				'x-forwarded-for': ip,
				...(cookie ? { cookie } : {}),
			},
			body: JSON.stringify(body),
		})
	);
}

async function get(auth: ReturnType<typeof betterAuth>, path: string, cookie?: string): Promise<Response> {
	return auth.handler(
		new Request(`${origin}/api/auth${path}`, {
			headers: { 'x-forwarded-for': '203.0.113.10', ...(cookie ? { cookie } : {}) },
		})
	);
}

function sessionCookie(response: Response): string {
	const cookie = response.headers.get('set-cookie')?.match(/(?:__Secure-)?better-auth\.session_token=[^;,]+/)?.[0];
	if (!cookie) throw new Error('Expected a Better Auth session cookie.');
	return cookie;
}

function followMagicLink(auth: ReturnType<typeof betterAuth>, url: string, ip: string): Promise<Response> {
	return auth.handler(new Request(url, { headers: { 'x-forwarded-for': ip } }));
}

async function requestMagicLink(
	auth: ReturnType<typeof betterAuth>,
	callerEmail = 'wrong-caller@example.com',
	ip?: string
): Promise<Response> {
	return post(
		auth,
		'/sign-in/magic-link',
		{
			email: callerEmail,
			callbackURL: '/unexpected',
			newUserCallbackURL: '/unexpected-new-user',
			errorCallbackURL: '/unexpected-error',
			metadata: { invitationId },
		},
		undefined,
		ip
	);
}

describe('invitation-only authentication contract', () => {
	test('creates a genuinely new verified user and grants membership only after password setup', async () => {
		const database = createDatabase();
		const { auth, deliveries } = createProtectedAuth(database);

		const arbitrarySignup = await post(auth, '/sign-up/email', {
			email: 'outsider@example.com',
			name: 'Outsider',
			password: 'outsider-password-123',
		});
		expect(arbitrarySignup.status).toBe(400);
		expect((await requestMagicLink(auth)).status).toBe(200);
		expect(deliveries).toHaveLength(1);
		expect(deliveries[0]?.email).toBe(inviteeEmail);
		expect(deliveries[0]?.url).toContain(encodeURIComponent(`/members/accept/${invitationId}`));

		const verification = await followMagicLink(auth, deliveries[0]!.url, '203.0.113.11');
		expect(verification.status).toBe(302);
		const inviteeCookie = sessionCookie(verification);
		expect(database.user.find((user) => user.email === inviteeEmail)).toMatchObject({ emailVerified: true });

		const beforePassword = await post(auth, '/organization/accept-invitation', { invitationId }, inviteeCookie);
		expect(beforePassword.status).toBe(403);
		expect(await beforePassword.json()).toMatchObject({ code: 'INVITATION_PASSWORD_REQUIRED' });
		expect(database.invitation[0]).toMatchObject({ status: 'pending' });
		expect(database.member).toHaveLength(1);

		const invitee = database.user.find((user) => user.email === inviteeEmail)!;
		await auth.api.setPassword({
			headers: new Headers({ cookie: inviteeCookie }),
			body: { newPassword: 'mailbox-owner-password-123' },
		});
		expect(database.account.some((account) => account.userId === invitee.id && account.providerId === 'credential')).toBe(true);
		const unauthorizedOrganization = await post(
			auth,
			'/organization/create',
			{ name: 'Unauthorized organization', slug: 'unauthorized-organization' },
			inviteeCookie
		);
		expect(unauthorizedOrganization.status).toBe(403);

		const acceptance = await post(auth, '/organization/accept-invitation', { invitationId }, inviteeCookie);
		expect(acceptance.status).toBe(200);
		expect(database.member.some((member) => member.userId === invitee.id)).toBe(true);
		expect(database.invitation[0]).toMatchObject({ status: 'accepted' });

		// An accepted historical invitation cannot restore a deliberately removed member.
		database.member.splice(
			database.member.findIndex((member) => member.userId === invitee.id),
			1
		);
		const restoreAttempt = await post(auth, '/organization/accept-invitation', { invitationId }, inviteeCookie);
		expect(restoreAttempt.status).toBe(400);
		expect(database.member.some((member) => member.userId === invitee.id)).toBe(false);
	});

	test('mailbox proof removes planted credentials and sessions while unverified password login stays blocked', async () => {
		const database = createDatabase();
		const preRegistrationAuth = createPreRegistrationAuth(database);
		const attackerSignup = await post(preRegistrationAuth, '/sign-up/email', {
			email: inviteeEmail,
			name: 'Attacker supplied name',
			password: 'attacker-password-123',
		});
		expect(attackerSignup.status).toBe(200);
		const attackerCookie = sessionCookie(attackerSignup);
		const plantedUser = database.user.find((user) => user.email === inviteeEmail)!;
		expect(plantedUser).toMatchObject({ emailVerified: false });

		const { auth, deliveries } = createProtectedAuth(database);
		const attackerLogin = await post(auth, '/sign-in/email', {
			email: inviteeEmail,
			password: 'attacker-password-123',
		});
		expect(attackerLogin.status).toBe(403);

		const ungatedMagicLink = await post(auth, '/sign-in/magic-link', {
			email: inviteeEmail,
			callbackURL: '/unexpected',
		});
		expect(ungatedMagicLink.status).toBe(400);
		expect((await requestMagicLink(auth)).status).toBe(200);
		expect(deliveries[0]?.email).toBe(inviteeEmail);
		const magicLinkUrl = deliveries[0]!.url;
		expect(database.verification[0]?.identifier).not.toBe(new URL(magicLinkUrl).searchParams.get('token'));

		const verification = await followMagicLink(auth, magicLinkUrl, '203.0.113.21');
		expect(verification.status).toBe(302);
		expect(verification.headers.get('location')).toBe(`${origin}/members/accept/${invitationId}`);
		const mailboxOwnerCookie = sessionCookie(verification);

		expect(database.user.find((user) => user.id === plantedUser.id)).toMatchObject({ emailVerified: true });
		expect(database.account.some((account) => account.userId === plantedUser.id && account.providerId === 'credential')).toBe(false);
		expect(database.session.some((session) => session.token === attackerCookie.split('=')[1])).toBe(false);
		expect(await (await get(auth, '/get-session', attackerCookie)).json()).toBeNull();

		const reusedMagicLink = await followMagicLink(auth, magicLinkUrl, '203.0.113.21');
		expect(reusedMagicLink.status).toBe(302);
		expect(reusedMagicLink.headers.get('location')).toContain('error=INVALID_TOKEN');
		expect(reusedMagicLink.headers.get('set-cookie')).toBeNull();
		expect(await (await get(auth, '/get-session', mailboxOwnerCookie)).json()).not.toBeNull();
	});

	test('rechecks cancellation and expiry while binding the stored token email to the callback invitation', async () => {
		const database = createDatabase();
		const { auth, deliveries } = createProtectedAuth(database);
		expect((await requestMagicLink(auth, undefined, '203.0.113.30')).status).toBe(200);
		const magicLinkUrl = deliveries[0]!.url;

		database.invitation.push({
			...database.invitation[0]!,
			id: 'other-live-invitation',
			email: 'other@example.com',
		});
		const rewritten = new URL(magicLinkUrl);
		for (const key of ['callbackURL', 'newUserCallbackURL', 'errorCallbackURL']) {
			rewritten.searchParams.set(key, '/members/accept/other-live-invitation');
		}
		const rewrittenAttempt = await followMagicLink(auth, rewritten.toString(), '203.0.113.31');
		expect(rewrittenAttempt.status).toBe(302);
		expect(rewrittenAttempt.headers.get('location')).toContain('error=INVALID_TOKEN');
		expect(rewrittenAttempt.headers.get('set-cookie')).toBeNull();

		database.invitation[0]!.status = 'canceled';
		const canceledAttempt = await followMagicLink(auth, magicLinkUrl, '203.0.113.31');
		expect(canceledAttempt.status).toBe(302);
		expect(canceledAttempt.headers.get('location')).toContain('error=INVITATION_UNAVAILABLE');
		expect(canceledAttempt.headers.get('set-cookie')).toBeNull();
		expect(database.user.some((user) => user.email === inviteeEmail)).toBe(false);

		database.invitation[0]!.status = 'pending';
		database.invitation[0]!.expiresAt = new Date(Date.now() - 1);
		const expiredAttempt = await followMagicLink(auth, magicLinkUrl, '203.0.113.31');
		expect(expiredAttempt.status).toBe(302);
		expect(expiredAttempt.headers.get('location')).toContain('error=INVITATION_UNAVAILABLE');
		expect(expiredAttempt.headers.get('set-cookie')).toBeNull();

		// The policy rejects before consuming the token or mutating the identity.
		database.invitation[0]!.expiresAt = new Date(Date.now() + 60_000);
		const liveAttempt = await followMagicLink(auth, magicLinkUrl, '203.0.113.31');
		expect(liveAttempt.status).toBe(302);
		expect(liveAttempt.headers.get('location')).toBe(`${origin}/members/accept/${invitationId}`);
		expect(sessionCookie(liveAttempt)).toContain('better-auth.session_token=');

		const replay = await followMagicLink(auth, magicLinkUrl, '203.0.113.31');
		expect(replay.status).toBe(302);
		expect(replay.headers.get('location')).toContain('error=INVALID_TOKEN');
		expect(replay.headers.get('set-cookie')).toBeNull();
	});

	test('rate limits repeated secure-link delivery through the public Better Auth handler', async () => {
		const database = createDatabase();
		const { auth, deliveries } = createProtectedAuth(database);
		const ip = '203.0.113.40';

		for (let request = 0; request < 5; request += 1) {
			expect((await requestMagicLink(auth, undefined, ip)).status).toBe(200);
		}
		const limited = await requestMagicLink(auth, undefined, ip);
		expect(limited.status).toBe(429);
		expect(deliveries).toHaveLength(5);
	});
});
