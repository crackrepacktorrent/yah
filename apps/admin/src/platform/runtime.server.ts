import 'server-only';
import { env } from 'virtual:env/server';
import { createPublicError } from './errors';

/** Keep every production server function closed when discovered by another runtime. */
export function requireProductionRuntime(): void {
	if (env.ADMIN_RUNTIME !== 'production') throw createPublicError('Not found.', 404);
}
