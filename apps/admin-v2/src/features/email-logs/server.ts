import { query } from '@solidjs/router';
import type { EmailLogPage, EmailLogPageQuery } from './contracts';
import { listAuthorizedEmailLogs } from './service';
import { surfaceError } from '~/platform/errors';
import { getServerRequest } from '~/platform/request';
import { requireProductionRuntime } from '~/platform/runtime.server';

async function dependencies() {
	const [{ enforcePermissions }, { productionEmailLogManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-email-log-manager.server'),
	]);
	return { enforcePermissions, manager: productionEmailLogManager };
}

export const listEmailLogs = query(async (input: EmailLogPageQuery): Promise<EmailLogPage> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await listAuthorizedEmailLogs(input, request.headers, await dependencies());
	} catch (error) {
		surfaceError(error);
	}
}, 'email-logs');
