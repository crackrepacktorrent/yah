import { query } from '$app/server';
import { auth } from '$lib/server/auth';
import { getRequestEvent } from '$app/server';
import { defaultRolePermissions } from '$lib/permissions';

export const getSession = query(async () => {
	const event = getRequestEvent();
	const session = await auth.api.getSession({
		headers: event.request.headers,
	});

	if (!session) {
		return null;
	}

	const activeMember = await auth.api.getActiveMember({
		headers: event.request.headers,
	}).catch(() => null);

	const role = (activeMember?.role as string) ?? null;

	// Resolve permissions: check static defaults first, then dynamic roles from DB
	let permissions: Record<string, string[]> = {};
	if (role) {
		if (defaultRolePermissions[role]) {
			permissions = defaultRolePermissions[role];
		} else {
			// Custom dynamic role — look up from DB
			try {
				const dynamicRole = await auth.api.getOrgRole({
					headers: event.request.headers,
					query: { roleName: role },
				});
				if (dynamicRole?.permission) {
					permissions = dynamicRole.permission;
				}
			} catch {
				// Role not found — no permissions
			}
		}
	}

	return {
		user: {
			name: session.user.name,
			email: session.user.email,
			image: session.user.image,
		},
		role,
		permissions,
	};
});
