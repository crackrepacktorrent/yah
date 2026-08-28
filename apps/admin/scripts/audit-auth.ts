import pg from 'pg';
import { AUTH_MAINTENANCE_LOCK_ID, ORG_SLUG } from '@yah/admin-core/constants';

const { Pool } = pg;
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();
let transactionStarted = false;
let lockHeld = false;

try {
	await client.query('SELECT pg_advisory_lock($1)', [AUTH_MAINTENANCE_LOCK_ID]);
	lockHeld = true;
	await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
	transactionStarted = true;
	const organizations = await client.query<{ id: string; name: string; slug: string }>(
		'SELECT id, name, slug FROM organization ORDER BY slug, id'
	);
	const owners = await client.query<{
		email: string;
		emailVerified: boolean;
		credentialCount: string;
		usableCredentialCount: string;
	}>(
		`SELECT u.email
		      , u."emailVerified"
		      , COUNT(a.id) FILTER (WHERE a."providerId" = 'credential')::text AS "credentialCount"
		      , COUNT(a.id) FILTER (WHERE a."providerId" = 'credential' AND a.password IS NOT NULL)::text AS "usableCredentialCount"
		 FROM member m
		 JOIN "user" u ON u.id = m."userId"
		 JOIN organization o ON o.id = m."organizationId"
		 LEFT JOIN account a ON a."userId" = u.id
		 WHERE o.slug = $1 AND 'owner' = ANY(string_to_array(m.role, ','))
		 GROUP BY u.id, u.email, u."emailVerified"
		 ORDER BY LOWER(u.email)`,
		[ORG_SLUG]
	);
	const unverifiedMembers = await client.query<{ email: string; role: string }>(
		`SELECT u.email, m.role
		 FROM member m
		 JOIN "user" u ON u.id = m."userId"
		 JOIN organization o ON o.id = m."organizationId"
		 WHERE o.slug = $1 AND u."emailVerified" = FALSE
		 ORDER BY LOWER(u.email)`,
		[ORG_SLUG]
	);
	const unverifiedSessions = await client.query<{ email: string; sessions: string }>(
		`SELECT u.email, COUNT(s.id)::text AS sessions
		 FROM session s
		 JOIN "user" u ON u.id = s."userId"
		 WHERE u."emailVerified" = FALSE
		 GROUP BY u.email
		 ORDER BY LOWER(u.email)`
	);
	const noncanonicalMemberships = await client.query<{ email: string; organizationSlug: string; role: string }>(
		`SELECT u.email, o.slug AS "organizationSlug", m.role
		 FROM member m
		 JOIN "user" u ON u.id = m."userId"
		 JOIN organization o ON o.id = m."organizationId"
		 WHERE o.slug <> $1
		 ORDER BY o.slug, LOWER(u.email)`,
		[ORG_SLUG]
	);
	const noncanonicalInvitations = await client.query<{ id: string; organizationSlug: string; status: string }>(
		`SELECT i.id, o.slug AS "organizationSlug", i.status
		 FROM invitation i
		 JOIN organization o ON o.id = i."organizationId"
		 WHERE o.slug <> $1
		 ORDER BY o.slug, i.id`,
		[ORG_SLUG]
	);
	const noncanonicalActiveSessions = await client.query<{ email: string; organizationSlug: string; sessions: string }>(
		`SELECT u.email, o.slug AS "organizationSlug", COUNT(s.id)::text AS sessions
		 FROM session s
		 JOIN "user" u ON u.id = s."userId"
		 JOIN organization o ON o.id = s."activeOrganizationId"
		 WHERE o.slug <> $1
		 GROUP BY u.email, o.slug
		 ORDER BY o.slug, LOWER(u.email)`,
		[ORG_SLUG]
	);
	const duplicateCaseEmails = await client.query<{ normalizedEmail: string; variants: string[]; users: string }>(
		`SELECT LOWER(email) AS "normalizedEmail", ARRAY_AGG(email ORDER BY email) AS variants, COUNT(*)::text AS users
		 FROM "user"
		 GROUP BY LOWER(email)
		 HAVING COUNT(*) > 1
		 ORDER BY LOWER(email)`
	);

	const canonicalOrganizations = organizations.rows.filter((organization) => organization.slug === ORG_SLUG);
	const noncanonicalOrganizations = organizations.rows.filter((organization) => organization.slug !== ORG_SLUG);
	const report = {
		canonicalOrganizations,
		canonicalOwners: owners.rows,
		noncanonicalOrganizations,
		noncanonicalMemberships: noncanonicalMemberships.rows,
		noncanonicalInvitations: noncanonicalInvitations.rows,
		noncanonicalActiveSessions: noncanonicalActiveSessions.rows,
		unverifiedCanonicalMembers: unverifiedMembers.rows,
		unverifiedSessions: unverifiedSessions.rows,
		duplicateCaseEmails: duplicateCaseEmails.rows,
	};
	console.log(JSON.stringify(report, null, 2));

	if (
		canonicalOrganizations.length !== 1 ||
		owners.rows.length === 0 ||
		owners.rows.some(
			(owner) =>
				!owner.emailVerified || Number(owner.credentialCount) !== 1 || Number(owner.usableCredentialCount) !== 1
		) ||
		noncanonicalOrganizations.length > 0 ||
		noncanonicalMemberships.rows.length > 0 ||
		noncanonicalInvitations.rows.length > 0 ||
		noncanonicalActiveSessions.rows.length > 0 ||
		unverifiedMembers.rows.length > 0 ||
		unverifiedSessions.rows.length > 0 ||
		duplicateCaseEmails.rows.length > 0
	) {
		console.error('Auth audit requires operator review before deployment.');
		process.exitCode = 1;
	}
	await client.query('COMMIT');
	transactionStarted = false;
} catch (error) {
	if (transactionStarted) await client.query('ROLLBACK').catch(() => undefined);
	throw error;
} finally {
	if (lockHeld) {
		await client.query('SELECT pg_advisory_unlock($1)', [AUTH_MAINTENANCE_LOCK_ID]).catch(() => undefined);
	}
	client.release();
	await pool.end();
}
