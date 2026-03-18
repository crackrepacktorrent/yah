import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';

const authHandler: Handle = async ({ event, resolve }) => {
	return svelteKitHandler({ event, resolve, auth, building });
};

const ADMIN_PREFIX = '/admin';
const ADMIN_LOGIN = '/admin/login';

const sessionHandler: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({
		headers: event.request.headers,
	});

	event.locals.session = session?.session ?? null;
	event.locals.user = session?.user ?? null;

	if (event.url.pathname.startsWith(ADMIN_PREFIX) && !event.url.pathname.startsWith(ADMIN_LOGIN)) {
		if (!event.locals.user) {
			throw redirect(303, '/admin/login');
		}
	}

	return resolve(event);
};

export const handle = sequence(authHandler, sessionHandler);
