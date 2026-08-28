import 'server-only';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { getMigrations } from 'better-auth/db/migration';
import { magicLink, organization } from 'better-auth/plugins';
import { Pool } from 'pg';
import { AUTH_MAINTENANCE_LOCK_ID, ORG_SLUG } from '@yah/admin-core/constants';
import {
	hashInvitationMagicLinkToken,
	INVITATION_MAGIC_LINK_EXPIRES_IN,
	invitationAuthPolicy,
} from '@yah/admin-core/invitation-auth-policy';
import { ac, roles } from '@yah/admin-core/permissions';
import { invitationCallbackPath } from '@yah/admin-core/invitation-path';
import { createListmonkTransactionalMailer } from '~/integrations/listmonk/transactional-email.server';
import { productionConfig } from '~/platform/config/production-env.server';
import { ensureOrganizationRoleIntegrity } from './role-integrity.server';

export const pool = new Pool({ connectionString: productionConfig.DATABASE_URL });
const mailer = createListmonkTransactionalMailer(productionConfig);

function dispatchPublicAuthEmail(task: Promise<unknown>): void {
	void task.catch((error) => console.error('[admin:auth-email] Background email delivery failed', error));
}

export const auth = betterAuth({
	secret: productionConfig.BETTER_AUTH_SECRET,
	baseURL: productionConfig.BETTER_AUTH_URL,
	database: pool,
	emailAndPassword: {
		enabled: true,
		disableSignUp: true,
		requireEmailVerification: true,
		revokeSessionsOnPasswordReset: true,
		sendResetPassword({ user, url }) {
			dispatchPublicAuthEmail(
				mailer.send({
					subscriberEmail: user.email,
					templateId: productionConfig.LISTMONK_PASSWORD_RESET_TEMPLATE_ID,
					data: { reset_link: url, user_name: user.name },
				}),
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
				await mailer.send({
					subscriberEmail: email,
					templateId: productionConfig.LISTMONK_ADMIN_ACCESS_TEMPLATE_ID,
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
				await mailer.send({
					subscriberEmail: data.email,
					templateId: productionConfig.LISTMONK_INVITATION_TEMPLATE_ID,
					data: {
						invite_link: new URL(invitationCallbackPath(data.id), productionConfig.BETTER_AUTH_URL).toString(),
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

async function initializeProductionAuth(): Promise<string> {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query('SELECT pg_advisory_xact_lock($1)', [AUTH_MAINTENANCE_LOCK_ID]);
		const { runMigrations } = await getMigrations(auth.options);
		await runMigrations();
		await ensureOrganizationRoleIntegrity(client);
		await client.query(
			`DELETE FROM session s
			 USING "user" u
			 WHERE s."userId" = u.id AND u."emailVerified" = FALSE`,
		);
		const organizations = await client.query<{ id: string }>('SELECT id FROM organization WHERE slug = $1', [ORG_SLUG]);
		if (organizations.rows.length !== 1 || !organizations.rows[0]) {
			throw new Error(`Production auth requires exactly one organization with slug ${ORG_SLUG}.`);
		}
		await client.query('COMMIT');
		return organizations.rows[0].id;
	} catch (error) {
		await client.query('ROLLBACK').catch(() => undefined);
		throw error;
	} finally {
		client.release();
	}
}

/** Eagerly awaited by production middleware before it accepts traffic. */
export const canonicalOrganizationId = await initializeProductionAuth();
