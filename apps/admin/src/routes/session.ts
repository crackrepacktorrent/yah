import { query, redirect } from '@solidjs/router';
import { getWebRequest } from '@solidjs/start/http';
import { auth } from '~/server/auth';
import { getBuiltInRolePermissions } from '~/lib/permissions';
import { ORG_SLUG } from '~/lib/constants';
import { mergePermissionSets, parseMemberRoles, parseStoredPermissionSet } from '~/lib/role-permissions';
import { surfaceError } from '~/server/http-errors';
export type Session = {
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

async function fetchSession(headers: Headers): Promise<Session | null> {
	const session = await auth.api.getSession({ headers });
	if (!session) return null;
	const authContext = await auth.$context;
	const organizationId = session.session.activeOrganizationId;
	const organization = organizationId
		? await authContext.adapter.findOne<{ slug: string }>({
				model: 'organization',
				where: [{ field: 'id', value: organizationId }],
			})
		: null;
	const canonicalOrganization = organization?.slug === ORG_SLUG;
	const activeMember = session.user.emailVerified && canonicalOrganization ? await auth.api.getActiveMember({ headers }) : null;
	const authorized = !!activeMember;

	const role = (activeMember?.role as string) ?? null;
	const roles = parseMemberRoles(role);
	const dynamicRoleNames = roles.filter((roleName) => !getBuiltInRolePermissions(roleName));
	const dynamicPermissions = new Map<string, Record<string, string[]>>();

	if (authorized && organizationId && dynamicRoleNames.length > 0) {
		const storedRoles = await authContext.adapter.findMany<{ role: string; permission: string }>({
			model: 'organizationRole',
			where: [
				{ field: 'organizationId', value: organizationId },
				{ field: 'role', value: dynamicRoleNames, operator: 'in' },
			],
		});

		for (const storedRole of storedRoles) {
			dynamicPermissions.set(storedRole.role, parseStoredPermissionSet(storedRole.permission));
		}
	}

	const permissionSets = roles.map((roleName) => getBuiltInRolePermissions(roleName) ?? dynamicPermissions.get(roleName) ?? {});
	const permissions = mergePermissionSets(permissionSets);

	return {
		user: {
			name: session.user.name,
			email: session.user.email,
			emailVerified: session.user.emailVerified,
			image: session.user.image,
		},
		authorized,
		role,
		roles,
		permissions,
	};
}

export const getSession = query(async (): Promise<Session | null> => {
	'use server';
	try {
		return await fetchSession(getWebRequest().headers);
	} catch (error) {
		surfaceError(error);
	}
}, 'session');

export const requireSession = query(async (): Promise<Session> => {
	'use server';
	let session: Session | null;
	try {
		session = await fetchSession(getWebRequest().headers);
	} catch (error) {
		surfaceError(error);
	}
	if (!session?.authorized) throw redirect('/login');
	return session;
}, 'require-session');
