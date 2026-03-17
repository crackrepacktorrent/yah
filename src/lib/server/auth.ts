import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { Pool } from 'pg';
import { env } from '$env/dynamic/private';

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET!,
	baseURL: env.BETTER_AUTH_URL!,
	database: new Pool({
		connectionString: env.DATABASE_URL!,
	}),
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		organization({
			async sendInvitationEmail(data) {
				const inviteLink = `${env.BETTER_AUTH_URL}/admin/accept-invitation/${data.id}`;
				console.log(`Invite ${data.email} to ${data.organization.name}: ${inviteLink}`);
				// TODO: integrate with Listmonk or Resend for actual email delivery
			},
		}),
		sveltekitCookies(getRequestEvent),
	],
});
