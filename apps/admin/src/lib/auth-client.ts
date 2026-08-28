import { createAuthClient } from 'better-auth/client';
import { magicLinkClient, organizationClient } from 'better-auth/client/plugins';
import { ac, roles } from '~/lib/permissions';

export const authClient = createAuthClient({
	plugins: [magicLinkClient(), organizationClient({ ac, roles })],
});
