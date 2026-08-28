import type { Permissions } from '@yah/admin-core/permissions';

/** Request-scoped server authority exposed to application services. */
export type AuthorizationContext = {
	requirePermissions(permissions: Permissions): Promise<void>;
	getCurrentUserId(): Promise<string>;
};
