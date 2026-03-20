import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';

const authHandler: Handle = async ({ event, resolve }) => {
	// Only run better-auth handler for auth API routes — skip for public pages
	if (event.url.pathname.startsWith('/api/auth')) {
		return svelteKitHandler({ event, resolve, auth, building });
	}
	return resolve(event);
};

const ADMIN_PREFIX = '/admin';
const ADMIN_LOGIN = '/admin/login';

const sessionHandler: Handle = async ({ event, resolve }) => {
	const isAdminRoute = event.url.pathname.startsWith(ADMIN_PREFIX);

	if (isAdminRoute) {
		let session = null;
		try {
			session = await auth.api.getSession({
				headers: event.request.headers,
			});
		} catch {
			// DB unavailable — redirect to login
		}

		event.locals.session = session?.session ?? null;
		event.locals.user = session?.user ?? null;

		const isPublicAdminRoute =
			event.url.pathname.startsWith(ADMIN_LOGIN) ||
			event.url.pathname.startsWith('/admin/members/accept/');

		if (!isPublicAdminRoute && !event.locals.user) {
			throw redirect(303, '/admin/login');
		}
	}

	return resolve(event);
};

export const handle = sequence(authHandler, sessionHandler);
