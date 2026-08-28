import type { AuthorizationContext } from '~/platform/auth/authorization-context';
import { createPublicInputParser } from '~/platform/public-input';
import { EmailLogPageQuerySchema, type EmailLogPage, type EmailLogPageQuery } from './contracts';

export type EmailLogManager = { list(input: { page: number }): Promise<EmailLogPage> };
export type EmailLogServiceDependencies = {
	authorization: AuthorizationContext;
	manager: EmailLogManager;
};
const parse = createPublicInputParser('Invalid log page.');

export async function listAuthorizedEmailLogs(
	input: EmailLogPageQuery,
	dependencies: EmailLogServiceDependencies,
): Promise<EmailLogPage> {
	const query = parse(EmailLogPageQuerySchema, input);
	// Process logs can contain hostnames, addresses, SQL diagnostics, and other
	// operational data. Keep them behind the provider-operations grant.
	await dependencies.authorization.requirePermissions({ provider: ['manage'] });
	return dependencies.manager.list(query);
}
