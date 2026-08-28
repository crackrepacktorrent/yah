import type { Permissions } from '@yah/admin-core/permissions';
import * as v from 'valibot';
import { EmailLogPageQuerySchema, type EmailLogPage, type EmailLogPageQuery } from './contracts';
import { createPublicError } from '~/platform/errors';

export type EmailLogManager = { list(input: { page: number }): Promise<EmailLogPage> };
export type EmailLogServiceDependencies = {
	enforcePermissions(headers: Headers, permissions: Permissions): Promise<void>;
	manager: EmailLogManager;
};

export async function listAuthorizedEmailLogs(
	input: EmailLogPageQuery,
	headers: Headers,
	dependencies: EmailLogServiceDependencies,
): Promise<EmailLogPage> {
	const parsed = v.safeParse(EmailLogPageQuerySchema, input);
	if (!parsed.success) throw createPublicError(parsed.issues[0]?.message ?? 'Invalid log page.', 400);
	// Process logs can contain hostnames, addresses, SQL diagnostics, and other
	// operational data. Keep them behind the provider-operations grant.
	await dependencies.enforcePermissions(headers, { provider: ['manage'] });
	return dependencies.manager.list(parsed.output);
}
