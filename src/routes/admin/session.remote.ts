import { query } from '$app/server';
import { auth } from '$lib/server/auth';
import { getRequestEvent } from '$app/server';

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

	return {
		user: {
			name: session.user.name,
			email: session.user.email,
			image: session.user.image,
		},
		role: (activeMember?.role as string) ?? null,
	};
});
