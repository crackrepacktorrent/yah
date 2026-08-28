import { createAuthClient } from 'better-auth/client';
import { magicLinkClient, organizationClient } from 'better-auth/client/plugins';
import { ac, roles } from '@yah/admin-core/permissions';

/**
 * Framework-neutral Better Auth client. Solid 2 owns the signals that consume
 * these promise APIs; do not import Better Auth's Solid 1 hook adapter here.
 */
export const authClient = createAuthClient({
	basePath: '/api/auth',
	plugins: [magicLinkClient(), organizationClient({ ac, roles })],
});
