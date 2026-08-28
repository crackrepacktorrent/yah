import { query } from '@solidjs/router';
import { redirect } from '@solidjs/web';
import { env } from 'virtual:env/server';
import type { ProjectedSession } from './authorization.server';
import { surfaceError } from '~/platform/errors';
import { getServerRequest } from '~/platform/request';

async function fetchProductionSession(): Promise<ProjectedSession | null> {
	const request = getServerRequest();
	if (env.ADMIN_V2_RUNTIME !== 'production') return null;

	try {
		const { projectSession } = await import('./authorization.server');
		return await projectSession(request.headers);
	} catch (error) {
		surfaceError(error);
	}
}

export const getSession = query(async (): Promise<ProjectedSession | null> => {
	'use server';
	return fetchProductionSession();
}, 'session');

export const requireSession = query(async (): Promise<ProjectedSession> => {
	'use server';
	const session = await fetchProductionSession();
	if (!session?.authorized) throw redirect('/login');
	return session;
}, 'require-session');
