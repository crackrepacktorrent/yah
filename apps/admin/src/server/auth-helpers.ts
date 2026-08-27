import { getWebRequest } from '@solidjs/start/http';
import { auth } from '~/server/auth';
import { ORG_SLUG } from '~/lib/constants';
import { HttpError, surfaceError } from './http-errors';

export { HttpError, surfaceError } from './http-errors';

type Permissions = Record<string, string[]>;

export async function getSessionOrThrow() {
	const request = getWebRequest();
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		throw new HttpError('Not authenticated', 401);
	}
	if (!session.user.emailVerified) {
		throw new HttpError('Email verification is required', 403);
	}
	const organizationId = session.session.activeOrganizationId;
	if (!organizationId) throw new HttpError('No active organization', 403);
	const { adapter } = await auth.$context;
	const organization = await adapter.findOne<{ slug: string }>({
		model: 'organization',
		where: [{ field: 'id', value: organizationId }],
	});
	if (organization?.slug !== ORG_SLUG) {
		throw new HttpError('This account is not authorized for the configured organization', 403);
	}
	const member = await adapter.findOne<{ id: string }>({
		model: 'member',
		where: [
			{ field: 'organizationId', value: organizationId },
			{ field: 'userId', value: session.user.id },
		],
	});
	if (!member) throw new HttpError('This account is not a member of the configured organization', 403);
	return session;
}

export async function enforcePermissions(permissions: Permissions) {
	const session = await getSessionOrThrow();
	const request = getWebRequest();
	const result = await auth.api.hasPermission({
		headers: request.headers,
		body: { organizationId: session.session.activeOrganizationId!, permissions },
	});
	if (!result.success) {
		throw new HttpError(result.error ?? 'Insufficient permissions', 403);
	}
}

/**
 * Enforces RBAC and surfaces API errors. Call inside any 'use server' function
 * to replace the enforcePermissions + try/catch/surfaceError boilerplate.
 */
export async function withPermissions<T>(permissions: Permissions, fn: () => Promise<T>): Promise<T> {
	try {
		await enforcePermissions(permissions);
		return await fn();
	} catch (err) {
		surfaceError(err);
	}
}
