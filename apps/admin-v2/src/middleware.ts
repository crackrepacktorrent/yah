import { createAPIHandler } from 'filesystem-routing/api';
import { env } from 'virtual:env/server';
import routes from 'virtual:file-routes';
import { createAdminRuntimeGuard, rejectUnhandledApiRequests } from '~/platform/http-boundary';

if (env.ADMIN_V2_RUNTIME === 'compatibility-lab' && !env.ADMIN_V2_COMPATIBILITY_AUTH_SECRET) {
	throw new Error('ADMIN_V2_COMPATIBILITY_AUTH_SECRET is required in compatibility-lab mode.');
}
if (env.ADMIN_V2_RUNTIME === 'production') {
	// Production must validate env, finish migrations/session cleanup, and
	// resolve the canonical organization before any request is accepted.
	await import('~/platform/auth/production-server');
}

export default [createAdminRuntimeGuard(env.ADMIN_V2_RUNTIME), createAPIHandler(routes), rejectUnhandledApiRequests];
