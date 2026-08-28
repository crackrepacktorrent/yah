import 'server-only';
import { getBuiltInRolePermissions, type Permissions } from '@yah/admin-core/permissions';
import { mergePermissionSets, parseMemberRoles, parseStoredPermissionSet } from '@yah/admin-core/role-permissions';
import { createPublicError } from '~/platform/errors';
import type { AuthorizationContext } from './authorization-context';
import { auth, canonicalOrganizationId } from './production-server';

type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
type MemberRecord = { id: string; role: string };

export type CanonicalSessionState = {
	session: AuthSession;
	member: MemberRecord | null;
};

export type ProjectedSession = {
	user: {
		name: string | null;
		email: string;
		emailVerified: boolean;
		image: string | null | undefined;
	};
	authorized: boolean;
	role: string | null;
	roles: string[];
	permissions: Record<string, string[]>;
};

/** Resolve authentication and canonical membership exactly once per operation. */
export async function resolveCanonicalSession(headers: Headers): Promise<CanonicalSessionState | null> {
	const session = await auth.api.getSession({ headers });
	if (!session) return null;

	if (!session.user.emailVerified || session.session.activeOrganizationId !== canonicalOrganizationId) {
		return { session, member: null };
	}

	const { adapter } = await auth.$context;
	const member = await adapter.findOne<MemberRecord>({
		model: 'member',
		where: [
			{ field: 'organizationId', value: canonicalOrganizationId },
			{ field: 'userId', value: session.user.id },
		],
	});

	return { session, member };
}

export async function projectSession(headers: Headers): Promise<ProjectedSession | null> {
	const state = await resolveCanonicalSession(headers);
	if (!state) return null;

	const role = state.member?.role ?? null;
	const roles = parseMemberRoles(role);
	const dynamicRoleNames = roles.filter((roleName) => !getBuiltInRolePermissions(roleName));
	const dynamicPermissions = new Map<string, Record<string, string[]>>();

	if (state.member && dynamicRoleNames.length > 0) {
		const { adapter } = await auth.$context;
		const storedRoles = await adapter.findMany<{ role: string; permission: string }>({
			model: 'organizationRole',
			where: [
				{ field: 'organizationId', value: canonicalOrganizationId },
				{ field: 'role', value: dynamicRoleNames, operator: 'in' },
			],
		});

		for (const storedRole of storedRoles) {
			dynamicPermissions.set(storedRole.role, parseStoredPermissionSet(storedRole.permission));
		}
	}

	const permissions = mergePermissionSets(
		roles.map((roleName) => getBuiltInRolePermissions(roleName) ?? dynamicPermissions.get(roleName) ?? {}),
	);

	return {
		user: {
			name: state.session.user.name,
			email: state.session.user.email,
			emailVerified: state.session.user.emailVerified,
			image: state.session.user.image,
		},
		authorized: !!state.member,
		role,
		roles,
		permissions,
	};
}

export async function requireCanonicalSession(headers: Headers): Promise<CanonicalSessionState & { member: MemberRecord }> {
	const state = await resolveCanonicalSession(headers);
	if (!state) throw createPublicError('Not authenticated', 401);
	if (!state.session.user.emailVerified) throw createPublicError('Email verification is required', 403);
	if (state.session.session.activeOrganizationId !== canonicalOrganizationId) {
		throw createPublicError('This account is not authorized for the configured organization', 403);
	}
	if (!state.member) throw createPublicError('This account is not a member of the configured organization', 403);
	return { ...state, member: state.member };
}

/** Create one isolated authorization cache for one server-function invocation. */
export function createAuthorizationContext(headers: Headers): AuthorizationContext {
	let canonicalSession: ReturnType<typeof requireCanonicalSession> | undefined;
	const atomicPermissions = new Map<string, Promise<void>>();

	const requireSession = () => (canonicalSession ??= requireCanonicalSession(headers));
	const requireAtomicPermission = (resource: string, action: string): Promise<void> => {
		const key = JSON.stringify([resource, action]);
		const cached = atomicPermissions.get(key);
		if (cached) return cached;

		const pending = (async () => {
			const requirement = { [resource]: [action] } as Permissions;
			const result = await auth.api.hasPermission({
				headers,
				body: { organizationId: canonicalOrganizationId, permissions: requirement },
			});
			if (!result.success) throw createPublicError(result.error ?? 'Insufficient permissions', 403);
		})();
		atomicPermissions.set(key, pending);
		return pending;
	};

	return {
		async getCurrentUserId() {
			return (await requireSession()).session.user.id;
		},
		async requirePermissions(permissions) {
			await requireSession();
			const requirements: Array<readonly [resource: string, action: string]> = [];
			for (const [resource, actions] of Object.entries(permissions)) {
				for (const action of new Set(actions)) requirements.push([resource, action]);
			}
			// Better Auth applies one member role to a compound requirement, while
			// YAH intentionally authorizes the union of assigned roles. Keep Better
			// Auth authoritative by checking each atomic grant, in parallel.
			await Promise.all(requirements.map(([resource, action]) => requireAtomicPermission(resource, action)));
		},
	};
}
