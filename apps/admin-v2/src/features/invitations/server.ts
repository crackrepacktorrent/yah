import { query } from '@solidjs/router';
import { ORG_SLUG } from '@yah/admin-core/constants';
import * as v from 'valibot';
import { createPublicError, surfaceError } from '~/platform/errors';
import { getServerRequest } from '~/platform/request';
import { requireProductionRuntime } from '~/platform/runtime.server';

const invitationIdSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(255));
const completeAccountSchema = v.strictObject({
	invitationId: invitationIdSchema,
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
	password: v.pipe(v.string(), v.minLength(8), v.maxLength(128)),
});

export type CompleteInvitationAccountCommand = v.InferInput<typeof completeAccountSchema>;

export type InvitationInfo = {
	status: string;
	expired: boolean;
	sessionMatches: boolean;
	sessionHasPassword: boolean;
	organizationId: string | null;
	organizationName: string | null;
	role: string | null;
};

function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: TSchema, input: unknown): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, input);
	if (!result.success) throw createPublicError('Invalid request.', 400);
	return result.output;
}

export const getInvitationInfo = query(async (id: string): Promise<InvitationInfo | null> => {
	'use server';
	const request = getServerRequest();

	try {
		requireProductionRuntime();
		const invitationId = parse(invitationIdSchema, id);
		const { auth, pool } = await import('~/platform/auth/production-server');
		const result = await pool.query(
			`SELECT i.email, i.role, i.status, i."organizationId", o.name AS "organizationName",
			        i."expiresAt" <= NOW() AS expired
			 FROM invitation i
			 JOIN organization o ON o.id = i."organizationId"
			 WHERE i.id = $1 AND o.slug = $2`,
			[invitationId, ORG_SLUG],
		);
		if (result.rows.length === 0) return null;

		const row = result.rows[0] as {
			email: string;
			role: string;
			status: string;
			organizationId: string;
			organizationName: string;
			expired: boolean;
		};
		const session = await auth.api.getSession({ headers: request.headers });
		const sessionMatches = !!session && session.user.email.trim().toLowerCase() === row.email.trim().toLowerCase();
		const revealDetails = sessionMatches && session.user.emailVerified;
		let sessionHasPassword = false;

		if (revealDetails) {
			const { internalAdapter } = await auth.$context;
			const accounts = await internalAdapter.findAccounts(session.user.id);
			sessionHasPassword = accounts.some((account) => account.providerId === 'credential' && !!account.password);
		}

		return {
			status: row.status,
			expired: row.expired,
			sessionMatches,
			sessionHasPassword,
			organizationId: revealDetails ? row.organizationId : null,
			organizationName: revealDetails ? row.organizationName : null,
			role: revealDetails ? row.role : null,
		};
	} catch (error) {
		surfaceError(error);
	}
}, 'invitation-info');

/** Establish the mailbox owner's password before membership is granted. */
export async function completeInvitationAccount(input: CompleteInvitationAccountCommand): Promise<void> {
	'use server';
	const request = getServerRequest();

	try {
		requireProductionRuntime();
		const data = parse(completeAccountSchema, input);
		const { auth, pool } = await import('~/platform/auth/production-server');
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user.emailVerified) throw createPublicError('Use the secure access link before setting a password.', 403);

		const result = await pool.query<{ email: string }>(
			`SELECT i.email
			 FROM invitation i
			 JOIN organization o ON o.id = i."organizationId"
			 WHERE i.id = $1 AND i.status = 'pending' AND i."expiresAt" > NOW() AND o.slug = $2`,
			[data.invitationId, ORG_SLUG],
		);
		const invitation = result.rows[0];
		if (!invitation || invitation.email.trim().toLowerCase() !== session.user.email.trim().toLowerCase()) {
			throw createPublicError('This invitation does not belong to the signed-in account.', 403);
		}

		const authContext = await auth.$context;
		const accounts = await authContext.internalAdapter.findAccounts(session.user.id);
		if (accounts.some((account) => account.providerId === 'credential' && account.password)) {
			throw createPublicError(
				'A password is already set. Use the password from your first attempt, or reset it from the login page.',
				409,
			);
		}

		await auth.api.updateUser({ headers: request.headers, body: { name: data.name } });
		await auth.api.setPassword({ headers: request.headers, body: { newPassword: data.password } });
	} catch (error) {
		surfaceError(error);
	}
}

/** Accept only an invitation observed as live in this invocation. */
export async function acceptInvitation(id: string): Promise<{ organizationId: string }> {
	'use server';
	const request = getServerRequest();

	try {
		requireProductionRuntime();
		const invitationId = parse(invitationIdSchema, id);
		const { auth, pool } = await import('~/platform/auth/production-server');
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user.emailVerified) throw createPublicError('Use the secure access link before accepting.', 403);

		const { internalAdapter } = await auth.$context;
		const accounts = await internalAdapter.findAccounts(session.user.id);
		if (!accounts.some((account) => account.providerId === 'credential' && account.password)) {
			throw createPublicError('Set a password before accepting this invitation.', 403);
		}

		const result = await pool.query<{ email: string; organizationId: string }>(
			`SELECT i.email, i."organizationId"
			 FROM invitation i
			 JOIN organization o ON o.id = i."organizationId"
			 WHERE i.id = $1 AND i.status = 'pending' AND i."expiresAt" > NOW() AND o.slug = $2`,
			[invitationId, ORG_SLUG],
		);
		const invitation = result.rows[0];
		if (!invitation || invitation.email.trim().toLowerCase() !== session.user.email.trim().toLowerCase()) {
			throw createPublicError('This invitation is unavailable or does not belong to this account.', 403);
		}

		await auth.api.acceptInvitation({ headers: request.headers, body: { invitationId } });
		return { organizationId: invitation.organizationId };
	} catch (error) {
		surfaceError(error);
	}
}
