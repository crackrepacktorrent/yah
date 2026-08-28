import { query } from '@solidjs/router';
import type { EmailLogPage, EmailLogPageQuery } from './contracts';
import { listAuthorizedEmailLogs } from './service';
import { runProductionRequest } from '~/platform/production-request.server';

async function requestDependencies(headers: Headers) {
	const [{ createAuthorizationContext }, { productionEmailLogManager }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/integrations/listmonk/production-email-log-manager.server'),
	]);
	return { authorization: createAuthorizationContext(headers), manager: productionEmailLogManager };
}

export const listEmailLogs = query(async (input: EmailLogPageQuery): Promise<EmailLogPage> => {
	'use server';
	return runProductionRequest(async (request) => listAuthorizedEmailLogs(input, await requestDependencies(request.headers)));
}, 'email-logs');
