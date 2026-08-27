import { betterAuth } from 'better-auth';
import { hashPassword } from 'better-auth/crypto';
import { getMigrations } from 'better-auth/db/migration';
import { organization } from 'better-auth/plugins';
import pg from 'pg';
import { AUTH_MAINTENANCE_LOCK_ID, ORG_SLUG } from '../src/lib/constants';
import { ac, roles } from '../src/lib/permissions';

const { Pool } = pg;
const ORGANIZATION_NAME = 'Youth Alliance for Housing';

function required(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required.`);
	return value;
}

const databaseUrl = required('DATABASE_URL');
const secret = required('BETTER_AUTH_SECRET');
const email = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
const name = required('BOOTSTRAP_ADMIN_NAME');
const password = required('BOOTSTRAP_ADMIN_PASSWORD');

if (secret.length < 32) throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
if (password.length < 16 || password.length > 128) {
	throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain between 16 and 128 characters.');
}

const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const bootstrapAuth = betterAuth({
	secret,
	baseURL: 'http://bootstrap.invalid',
	database: pool,
	emailAndPassword: { enabled: true },
	plugins: [organization({ ac, roles, allowUserToCreateOrganization: false, dynamicAccessControl: { enabled: true } })],
});

async function bootstrap(): Promise<void> {
	const lockClient = await pool.connect();

	try {
		await lockClient.query('SELECT pg_advisory_lock($1)', [AUTH_MAINTENANCE_LOCK_ID]);
		const { runMigrations } = await getMigrations(bootstrapAuth.options);
		await runMigrations();

		const passwordHash = await hashPassword(password);
		const userId = crypto.randomUUID();
		const organizationId = crypto.randomUUID();
		await lockClient.query('BEGIN');
		const inventory = await lockClient.query<{ users: string; organizations: string }>(
			`SELECT
			  (SELECT COUNT(*) FROM "user") AS users,
			  (SELECT COUNT(*) FROM organization) AS organizations`
		);
		const counts = inventory.rows[0];
		if (!counts || Number(counts.users) !== 0 || Number(counts.organizations) !== 0) {
			throw new Error('Fresh bootstrap refused: users or organizations already exist. Run ops:audit-auth and review the deployment state.');
		}

		await lockClient.query(
			`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, TRUE, NOW(), NOW())`,
			[userId, name, email]
		);
		await lockClient.query(
			`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
			 VALUES ($1, $2, 'credential', $2, $3, NOW(), NOW())`,
			[crypto.randomUUID(), userId, passwordHash]
		);
		await lockClient.query(
			'INSERT INTO organization (id, name, slug, "createdAt") VALUES ($1, $2, $3, NOW())',
			[organizationId, ORGANIZATION_NAME, ORG_SLUG]
		);
		await lockClient.query(
			'INSERT INTO member (id, "organizationId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4, NOW())',
			[crypto.randomUUID(), organizationId, userId, 'owner']
		);
		await lockClient.query('COMMIT');

		console.log(`Created the verified ${ORG_SLUG} owner account for ${email}.`);
		console.log('No bootstrap session was created. Sign in normally and rotate the bootstrap password.');
	} catch (error) {
		await lockClient.query('ROLLBACK').catch(() => undefined);
		throw error;
	} finally {
		await lockClient.query('SELECT pg_advisory_unlock($1)', [AUTH_MAINTENANCE_LOCK_ID]).catch(() => undefined);
		lockClient.release();
	}
}

try {
	await bootstrap();
} finally {
	await pool.end();
}
