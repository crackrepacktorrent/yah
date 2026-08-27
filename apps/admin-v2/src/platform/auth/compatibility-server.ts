import { betterAuth } from 'better-auth';
import { memoryAdapter, type MemoryDB } from 'better-auth/adapters/memory';
import { env } from 'virtual:env/server';

if (env.ADMIN_V2_RUNTIME !== 'compatibility-lab') {
	throw new Error('The compatibility auth server is disabled outside compatibility-lab mode.');
}

if (!env.ADMIN_V2_COMPATIBILITY_AUTH_SECRET) {
	throw new Error('ADMIN_V2_COMPATIBILITY_AUTH_SECRET is required in compatibility-lab mode.');
}

const compatibilityDatabase: MemoryDB = {
	account: [],
	session: [],
	user: [],
	verification: [],
};

/**
 * Isolated compatibility-only auth instance. The production platform slice
 * will reuse the existing PostgreSQL schema, organization plugin, secrets, and
 * startup gate rather than this in-memory database.
 */
export const compatibilityAuth = betterAuth({
	baseURL: 'http://127.0.0.1:43121',
	secret: env.ADMIN_V2_COMPATIBILITY_AUTH_SECRET,
	database: memoryAdapter(compatibilityDatabase),
	emailAndPassword: { enabled: true },
	rateLimit: { enabled: false },
	trustedOrigins: ['http://127.0.0.1:43121', 'http://localhost:3010'],
});
