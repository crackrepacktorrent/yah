import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { createHash } from 'node:crypto';
import { ORG_SLUG } from './constants';
import { invitationCallbackPath } from './invitation-path';

type InvitationRecord = {
	id: string;
	email: string;
	status: string;
	expiresAt: Date | string;
	organizationId: string;
};

type OrganizationRecord = { slug: string };
type PolicyContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

type MagicLinkBody = {
	email?: unknown;
	metadata?: unknown;
	callbackURL?: unknown;
	newUserCallbackURL?: unknown;
	errorCallbackURL?: unknown;
};

type InvitationActionBody = { invitationId?: unknown };

type MagicLinkQuery = {
	token?: unknown;
	callbackURL?: unknown;
	newUserCallbackURL?: unknown;
	errorCallbackURL?: unknown;
};

function invitationError(): APIError {
	return new APIError('BAD_REQUEST', {
		code: 'INVITATION_UNAVAILABLE',
		message: 'This invitation is unavailable or has expired.',
	});
}

function passwordRequiredError(): APIError {
	return new APIError('FORBIDDEN', {
		code: 'INVITATION_PASSWORD_REQUIRED',
		message: 'Set a password before accepting this invitation.',
	});
}

export const INVITATION_MAGIC_LINK_EXPIRES_IN = 300;

export async function hashInvitationMagicLinkToken(token: string): Promise<string> {
	return createHash('sha256').update(token).digest('base64url');
}

function invitationIdFromCallback(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	let decoded: string;
	let url: URL;
	try {
		decoded = decodeURIComponent(value);
		if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
		url = new URL(decoded, 'http://invitation.local');
	} catch {
		return null;
	}
	const match = /^\/members\/accept\/([^/]+)$/.exec(url.pathname);
	if (!match?.[1] || url.search || url.hash) return null;
	try {
		const invitationId = decodeURIComponent(match[1]);
		return invitationCallbackPath(invitationId) === url.pathname ? invitationId : null;
	} catch {
		return null;
	}
}

async function findLiveCanonicalInvitation(ctx: PolicyContext, invitationId: string): Promise<InvitationRecord | null> {
	const invitation = await ctx.context.adapter.findOne<InvitationRecord>({
		model: 'invitation',
		where: [{ field: 'id', value: invitationId }],
	});
	if (!invitation || invitation.status !== 'pending' || new Date(invitation.expiresAt).getTime() <= Date.now()) return null;
	const organization = await ctx.context.adapter.findOne<OrganizationRecord>({
		model: 'organization',
		where: [{ field: 'id', value: invitation.organizationId }],
	});
	if (organization?.slug !== ORG_SLUG) return null;
	return invitation;
}

function redirectMagicLinkError(ctx: PolicyContext, invitationId: string, code: string): never {
	const errorURL = new URL(invitationCallbackPath(invitationId), ctx.context.baseURL);
	errorURL.searchParams.set('error', code);
	throw ctx.redirect(errorURL.toString());
}

function getInvitationId(metadata: unknown): string | null {
	if (!metadata || typeof metadata !== 'object' || !('invitationId' in metadata)) return null;
	const invitationId = metadata.invitationId;
	return typeof invitationId === 'string' && invitationId.length > 0 && invitationId.length <= 255 ? invitationId : null;
}

/** Restrict generic Better Auth endpoints to invitation-only onboarding. */
export function invitationAuthPolicy(): BetterAuthPlugin {
	return {
		id: 'invitation-auth-policy',
		hooks: {
			before: [
				{
					matcher: (ctx) => ctx.path === '/sign-in/magic-link',
					handler: createAuthMiddleware(async (ctx) => {
						const body = ctx.body as MagicLinkBody;
						const invitationId = getInvitationId(body.metadata);
						if (!invitationId || typeof body.email !== 'string') throw invitationError();
						const invitation = await findLiveCanonicalInvitation(ctx, invitationId);
						if (!invitation) throw invitationError();
						body.email = invitation.email;
						const callbackURL = invitationCallbackPath(invitationId);
						body.callbackURL = callbackURL;
						body.newUserCallbackURL = callbackURL;
						body.errorCallbackURL = callbackURL;
					}),
				},
				{
					matcher: (ctx) => ctx.path === '/magic-link/verify',
					handler: createAuthMiddleware(async (ctx) => {
						const query = ctx.query as MagicLinkQuery;
						const invitationIds = [query.callbackURL, query.newUserCallbackURL, query.errorCallbackURL].map(
							invitationIdFromCallback,
						);
						const invitationId = invitationIds[0];
						if (!invitationId || invitationIds.some((candidate) => candidate !== invitationId)) throw invitationError();
						const invitation = await findLiveCanonicalInvitation(ctx, invitationId);
						if (!invitation) redirectMagicLinkError(ctx, invitationId, 'INVITATION_UNAVAILABLE');
						if (typeof query.token !== 'string') redirectMagicLinkError(ctx, invitationId, 'INVALID_TOKEN');
						const verification = await ctx.context.internalAdapter.findVerificationValue(
							await hashInvitationMagicLinkToken(query.token),
						);
						if (!verification) redirectMagicLinkError(ctx, invitationId, 'INVALID_TOKEN');

						let payload: { email?: unknown };
						try {
							payload = JSON.parse(verification.value) as { email?: unknown };
						} catch (error) {
							ctx.context.logger.error('Stored invitation magic-link payload is invalid JSON', error);
							throw new APIError('INTERNAL_SERVER_ERROR', { message: 'The secure link could not be verified.' });
						}
						if (
							typeof payload.email !== 'string' ||
							payload.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()
						) {
							redirectMagicLinkError(ctx, invitationId, 'INVALID_TOKEN');
						}
					}),
				},
				{
					matcher: (ctx) => ctx.path === '/organization/accept-invitation',
					handler: createAuthMiddleware(async (ctx) => {
						const body = ctx.body as InvitationActionBody;
						if (typeof body.invitationId !== 'string') throw invitationError();
						if (!(await findLiveCanonicalInvitation(ctx, body.invitationId))) throw invitationError();
						const session = await getSessionFromCtx(ctx);
						if (!session) return;
						const accounts = await ctx.context.internalAdapter.findAccounts(session.user.id);
						if (!accounts.some((account) => account.providerId === 'credential' && account.password)) {
							throw passwordRequiredError();
						}
					}),
				},
			],
		},
	};
}
