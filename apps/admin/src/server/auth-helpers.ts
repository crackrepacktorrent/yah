import { getWebRequest } from '@solidjs/start/http';
import { auth } from '~/server/auth';

type Permissions = Record<string, string[]>;

export class HttpError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = 'HttpError';
	}
}

/**
 * Re-throws errors as HttpError so they survive serialization to the client.
 * SolidStart strips raw Error details for security — this ensures API errors
 * (Listmonk, Shlink, etc.) surface as user-visible messages.
 */
export function surfaceError(err: unknown): never {
	if (err instanceof HttpError) throw err;
	if (err instanceof Error) {
		const status = 'status' in err && typeof (err as { status: unknown }).status === 'number'
			? (err as { status: number }).status
			: 500;
		throw new HttpError(err.message, status);
	}
	throw new HttpError('An unexpected error occurred', 500);
}

export async function getSessionOrThrow() {
	const request = getWebRequest();
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		throw new HttpError('Not authenticated', 401);
	}
	return session;
}

export async function enforcePermissions(permissions: Permissions) {
	const request = getWebRequest();
	const result = await auth.api.hasPermission({
		headers: request.headers,
		body: { permissions },
	});
	if (!result.success) {
		throw new HttpError(result.error ?? 'Insufficient permissions', 403);
	}
}

/**
 * Enforces RBAC and surfaces API errors. Call inside any 'use server' function
 * to replace the enforcePermissions + try/catch/surfaceError boilerplate.
 */
export async function withPermissions<T>(
	permissions: Permissions,
	fn: () => Promise<T>,
): Promise<T> {
	await enforcePermissions(permissions);
	try {
		return await fn();
	} catch (err) {
		surfaceError(err);
	}
}
