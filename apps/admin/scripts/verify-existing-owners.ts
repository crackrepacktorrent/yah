import pg from 'pg';
import * as v from 'valibot';
import { AUTH_MAINTENANCE_LOCK_ID, ORG_SLUG } from '../src/lib/constants';
import { emailSchema } from '../src/lib/schemas';

const { Pool } = pg;
const CONFIRMATION = 'preserve-passwords-revoke-sessions';

interface ExistingOwner {
	id: string;
	email: string;
	emailVerified: boolean;
	role: string;
}

interface ExistingAccount {
	userId: string;
	providerId: string;
	password: string | null;
}

function required(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required.`);
	return value;
}

function parseExpectedEmails(value: string): string[] {
	const emails = value
		.split(',')
		.map((email) => email.trim())
		.filter(Boolean);
	if (emails.length === 0) throw new Error('OWNER_VERIFICATION_EMAILS must contain at least one email address.');
	let normalizedEmails: string[];
	try {
		normalizedEmails = emails.map((email) => v.parse(emailSchema, email).toLowerCase());
	} catch {
		throw new Error('OWNER_VERIFICATION_EMAILS contains an invalid email address.');
	}
	const uniqueEmails = new Set(normalizedEmails);
	if (uniqueEmails.size !== emails.length) throw new Error('OWNER_VERIFICATION_EMAILS contains a duplicate address.');
	return [...uniqueEmails].sort();
}

const databaseUrl = required('DATABASE_URL');
const expectedEmails = parseExpectedEmails(required('OWNER_VERIFICATION_EMAILS'));
if (required('OWNER_VERIFICATION_CONFIRMATION') !== CONFIRMATION) {
	throw new Error(`OWNER_VERIFICATION_CONFIRMATION must equal ${CONFIRMATION}.`);
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
let transactionStarted = false;
let lockHeld = false;

try {
	await client.query('SELECT pg_advisory_lock($1)', [AUTH_MAINTENANCE_LOCK_ID]);
	lockHeld = true;
	await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
	transactionStarted = true;

	const organizations = await client.query<{ id: string; slug: string }>(
		'SELECT id, slug FROM organization ORDER BY slug, id FOR UPDATE'
	);
	if (organizations.rows.length !== 1 || organizations.rows[0]?.slug !== ORG_SLUG) {
		throw new Error(`Owner verification requires exactly one organization with slug ${ORG_SLUG}.`);
	}
	const organizationId = organizations.rows[0].id;

	const members = await client.query<ExistingOwner>(
		`SELECT u.id, u.email, u."emailVerified", m.role
		 FROM member m
		 JOIN "user" u ON u.id = m."userId"
		 WHERE m."organizationId" = $1
		 ORDER BY LOWER(u.email), u.id
		 FOR UPDATE OF m, u`,
		[organizationId]
	);
	const actualEmails = members.rows.map((member) => member.email.toLowerCase()).sort();
	if (actualEmails.length !== expectedEmails.length || actualEmails.some((email, index) => email !== expectedEmails[index])) {
		throw new Error('OWNER_VERIFICATION_EMAILS must exactly match every member of the canonical organization.');
	}
	if (members.rows.some((member) => !member.role.split(',').map((role) => role.trim()).includes('owner'))) {
		throw new Error('Every canonical organization member must already have the owner role.');
	}
	if (members.rows.some((member) => member.emailVerified)) {
		throw new Error('Owner verification is one-time only; at least one expected owner is already verified.');
	}

	const userIds = members.rows.map((member) => member.id);
	const accounts = await client.query<ExistingAccount>(
		`SELECT "userId", "providerId", password
		 FROM account
		 WHERE "userId" = ANY($1::text[])
		 FOR UPDATE`,
		[userIds]
	);
	for (const owner of members.rows) {
		const credentials = accounts.rows.filter(
			(account) => account.userId === owner.id && account.providerId === 'credential'
		);
		if (credentials.length !== 1 || credentials[0]?.password === null) {
			throw new Error(`Expected exactly one password credential for ${owner.email}.`);
		}
	}

	const deletedSessions = await client.query('DELETE FROM session WHERE "userId" = ANY($1::text[])', [userIds]);
	const verifiedOwners = await client.query(
		`UPDATE "user"
		 SET "emailVerified" = TRUE, "updatedAt" = NOW()
		 WHERE id = ANY($1::text[]) AND "emailVerified" = FALSE`,
		[userIds]
	);
	if (verifiedOwners.rowCount !== members.rows.length) {
		throw new Error('The owner set changed during verification; no changes were committed.');
	}

	await client.query('COMMIT');
	transactionStarted = false;
	console.log(`Verified ${verifiedOwners.rowCount} existing ${ORG_SLUG} owners without changing password credentials.`);
	console.log(`Revoked ${deletedSessions.rowCount ?? 0} existing sessions; each owner must sign in again.`);
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
