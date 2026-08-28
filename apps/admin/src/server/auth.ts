import { betterAuth } from 'better-auth';
import { magicLink, organization } from 'better-auth/plugins';
import { APIError } from 'better-auth/api';
import { Pool } from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import { getListmonk } from '~/server/listmonk';
import { ac, roles } from '~/lib/permissions';
import { AUTH_MAINTENANCE_LOCK_ID, ORG_SLUG } from '~/lib/constants';
import { invitationCallbackPath } from '~/lib/invitation-path';
import { env } from '~/server/env';
import {
	hashInvitationMagicLinkToken,
	INVITATION_MAGIC_LINK_EXPIRES_IN,
	invitationAuthPolicy,
} from '~/server/invitation-auth-policy';

export const pool = new Pool({ connectionString: env.DATABASE_URL });

function dispatchPublicAuthEmail(task: Promise<unknown>): void {
	void task.catch((error) => console.error('[admin:auth-email] Background email delivery failed', error));
}

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	database: pool,
	emailAndPassword: {
		enabled: true,
		disableSignUp: true,
		requireEmailVerification: true,
		revokeSessionsOnPasswordReset: true,
		sendResetPassword({ user, url }) {
			dispatchPublicAuthEmail(
				getListmonk().sendTransactionalEmail({
					subscriberEmail: user.email,
					templateId: env.LISTMONK_PASSWORD_RESET_TEMPLATE_ID,
					data: {
						reset_link: url,
						user_name: user.name,
					},
				})
			);
			return Promise.resolve();
		},
	},
	plugins: [
		magicLink({
			disableSignUp: false,
			expiresIn: INVITATION_MAGIC_LINK_EXPIRES_IN,
			storeToken: { type: 'custom-hasher', hash: hashInvitationMagicLinkToken },
			async sendMagicLink({ email, url }) {
				await getListmonk().sendTransactionalEmail({
					subscriberEmail: email,
					templateId: env.LISTMONK_ADMIN_ACCESS_TEMPLATE_ID,
					data: { access_link: url },
				});
			},
		}),
		organization({
			ac,
			roles,
			allowUserToCreateOrganization: false,
			disableOrganizationDeletion: true,
			requireEmailVerificationOnInvitation: true,
			dynamicAccessControl: { enabled: true },
			organizationHooks: {
				async beforeCreateInvitation({ organization: targetOrganization }) {
					if (targetOrganization.slug !== ORG_SLUG) {
						throw new APIError('FORBIDDEN', { message: 'Invitations are restricted to the configured organization.' });
					}
				},
				async beforeUpdateOrganization({ organization: update }) {
					if (update.slug !== undefined && update.slug !== ORG_SLUG) {
						throw new APIError('FORBIDDEN', { message: 'The configured organization slug cannot be changed.' });
					}
				},
			},
			async sendInvitationEmail(data) {
				if (data.organization.slug !== ORG_SLUG) {
					throw new APIError('FORBIDDEN', { message: 'Invitations are restricted to the configured organization.' });
				}
				const inviteLink = new URL(invitationCallbackPath(data.id), env.BETTER_AUTH_URL).toString();
				await getListmonk().sendTransactionalEmail({
					subscriberEmail: data.email,
					templateId: env.LISTMONK_INVITATION_TEMPLATE_ID,
					data: {
						invite_link: inviteLink,
						org_name: data.organization.name,
						role: data.role,
					},
				});
			},
		}),
		invitationAuthPolicy(),
	],
	rateLimit: { enabled: true },
	advanced: {
		// Caddy replaces the inbound forwarding header with one client address.
		// Multi-hop proxy deployments must configure trustedProxies explicitly.
		ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
	},
});

async function runAuthMigrations(): Promise<void> {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		// Serialize startup migrations across replicas while retaining automatic
		// first-deploy bootstrapping. The lock is released on commit or disconnect.
		await client.query('SELECT pg_advisory_xact_lock($1)', [AUTH_MAINTENANCE_LOCK_ID]);
		const { runMigrations } = await getMigrations(auth.options);
		await runMigrations();
		// Requiring verified email prevents new unverified logins; revoke any
		// sessions minted under the older policy before accepting traffic.
		await client.query(
			`DELETE FROM session s
			 USING "user" u
			 WHERE s."userId" = u.id AND u."emailVerified" = FALSE`
		);
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK').catch(() => undefined);
		throw error;
	} finally {
		client.release();
	}
}

// Do not accept requests against a partially initialized auth schema.
await runAuthMigrations();
