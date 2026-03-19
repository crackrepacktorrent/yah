import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { Pool } from 'pg';
import { env } from '$env/dynamic/private';
import { getListmonk } from '$lib/server/listmonk';
import { ac, roles } from '$lib/permissions';
import { getMigrations } from 'better-auth/db/migration';

const pool = new Pool({ connectionString: env.DATABASE_URL! });

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET!,
	baseURL: env.BETTER_AUTH_URL!,
	database: pool,
	emailAndPassword: {
		enabled: true,
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
						templateId: Number(env.LISTMONK_INVITATION_TEMPLATE_ID),
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
		sveltekitCookies(getRequestEvent),
	],
});

// Auto-migrate database tables on startup (idempotent — safe to run every time)
getMigrations(auth.options).then(async ({ runMigrations }) => {
	await runMigrations();
}).catch((err) => {
	console.error('[auth] Migration failed:', err);
});
