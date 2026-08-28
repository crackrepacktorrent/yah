import { query } from '@solidjs/router';
import { withPermissions } from '~/server/auth-helpers';
import { env } from '~/server/env';

export const getSubscriptionFormConfig = query(async (): Promise<{ publicSiteUrl: string }> => {
	'use server';
	return withPermissions({ list: ['view'] }, async () => ({
		publicSiteUrl: env.PUBLIC_SITE_URL,
	}));
}, 'getSubscriptionFormConfig');
