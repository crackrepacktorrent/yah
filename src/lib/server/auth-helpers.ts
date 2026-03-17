import { auth } from '$lib/server/auth';
import { getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';

type Role = 'owner' | 'admin' | 'member';

export async function getSessionOrThrow() {
	const event = getRequestEvent();
	const session = await auth.api.getSession({
		headers: event.request.headers,
	});

	if (!session) {
		error(401, 'Not authenticated');
	}

	return session;
}

export async function requireRole(...roles: Role[]) {
	const session = await getSessionOrThrow();
	const event = getRequestEvent();

	const activeMember = await auth.api.getActiveMember({
		headers: event.request.headers,
	});

	if (!activeMember) {
		error(403, 'Not a member of any organization');
	}

	if (!roles.includes(activeMember.role as Role)) {
		error(403, `Requires one of: ${roles.join(', ')}`);
	}

	return {
		user: session.user,
		session: session.session,
		role: activeMember.role as Role,
		memberId: activeMember.id,
	};
}
