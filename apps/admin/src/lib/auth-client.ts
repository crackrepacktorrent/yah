import { createAuthClient } from 'better-auth/solid';
import { organizationClient } from 'better-auth/client/plugins';
import { ac, roles } from '~/lib/permissions';

export const authClient = createAuthClient({
	plugins: [
		organizationClient({ ac, roles }),
	],
});
