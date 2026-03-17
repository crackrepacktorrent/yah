/**
 * Seed script: creates the YAH organization and makes a user the owner.
 *
 * Usage:
 *   npx tsx scripts/seed-org.ts admin@y4h.org
 */

import pg from 'pg';

const { Pool } = pg;

const email = process.argv[2];
if (!email) {
	console.error('Usage: npx tsx scripts/seed-org.ts <email>');
	process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('DATABASE_URL environment variable is required');
	process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function seed() {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		// Find user by email
		const userResult = await client.query('SELECT id FROM "user" WHERE email = $1', [email]);
		if (userResult.rows.length === 0) {
			throw new Error(`No user found with email: ${email}`);
		}
		const userId = userResult.rows[0].id;

		// Check if org already exists
		const orgResult = await client.query('SELECT id FROM organization WHERE slug = $1', ['yah']);
		let orgId: string;

		if (orgResult.rows.length > 0) {
			orgId = orgResult.rows[0].id;
			console.log(`Organization "yah" already exists (id: ${orgId})`);
		} else {
			// Create the organization
			orgId = crypto.randomUUID();
			await client.query(
				`INSERT INTO organization (id, name, slug, "createdAt") VALUES ($1, $2, $3, NOW())`,
				[orgId, 'Youth Alliance for Housing', 'yah'],
			);
			console.log(`Created organization "Youth Alliance for Housing" (id: ${orgId})`);
		}

		// Check if user is already a member
		const memberResult = await client.query(
			'SELECT id, role FROM member WHERE "organizationId" = $1 AND "userId" = $2',
			[orgId, userId],
		);

		if (memberResult.rows.length > 0) {
			if (memberResult.rows[0].role === 'owner') {
				console.log(`User ${email} is already an owner.`);
			} else {
				await client.query('UPDATE member SET role = $1 WHERE id = $2', [
					'owner',
					memberResult.rows[0].id,
				]);
				console.log(`Updated ${email} role to owner.`);
			}
		} else {
			const memberId = crypto.randomUUID();
			await client.query(
				`INSERT INTO member (id, "organizationId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4, NOW())`,
				[memberId, orgId, userId, 'owner'],
			);
			console.log(`Added ${email} as owner.`);
		}

		await client.query('COMMIT');
		console.log('Done.');
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	} finally {
		client.release();
		await pool.end();
	}
}

seed().catch((err) => {
	console.error(err);
	process.exit(1);
});
