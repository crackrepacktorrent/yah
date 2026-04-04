import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { Pool } from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import { getListmonk } from '~/server/listmonk';
import { ac, roles } from '~/lib/permissions';
import { env } from '~/server/env';

const pool = new Pool({ connectionString: env.DATABASE_URL });

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	database: pool,
	emailAndPassword: {
		enabled: true,
		async sendResetPassword({ user, url }) {
			try {
				await getListmonk().sendTransactionalEmail({
					subscriberEmail: user.email,
					templateId: env.LISTMONK_PASSWORD_RESET_TEMPLATE_ID,
					data: {
						reset_link: url,
						user_name: user.name,
					},
				});
			} catch (err) {
				console.error('Failed to send password reset email:', err);
			}
		},
	},
	plugins: [
		organization({
			ac,
			roles,
			dynamicAccessControl: { enabled: true },
			async sendInvitationEmail(data) {
				const inviteLink = `${env.BETTER_AUTH_URL}/admin/members/accept/${data.id}`;
				try {
					await getListmonk().sendTransactionalEmail({
						subscriberEmail: data.email,
						templateId: env.LISTMONK_INVITATION_TEMPLATE_ID,
						data: {
							invite_link: inviteLink,
							org_name: data.organization.name,
							role: data.role,
						},
					});
				} catch (err) {
					console.error('Failed to send invitation email:', err);
				}
			},
		}),
	],
});

// Auto-migrate database tables on startup (idempotent — safe to run every time)
getMigrations(auth.options).then(async ({ runMigrations }: { runMigrations: () => Promise<void> }) => {
	await runMigrations();
}).catch((err: unknown) => {
	const msg = err instanceof AggregateError
		? err.errors.map((e: unknown) => (e instanceof Error ? e.message : String(e))).join('; ')
		: err instanceof Error ? err.message : String(err);
	console.error('[auth] Migration failed — ensure DATABASE_URL is reachable:', msg);
});
