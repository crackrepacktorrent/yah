import { query } from '@solidjs/router';
import { pool } from '~/server/auth';

export type InvitationInfo = {
	email: string;
	organizationName: string;
	role: string;
	status: string;
};

export const getInvitationInfo = query(async (id: string): Promise<InvitationInfo | null> => {
	'use server';
	const result = await pool.query(
		`SELECT i.email, i.role, i.status, o.name AS "organizationName"
		 FROM invitation i
		 JOIN organization o ON o.id = i."organizationId"
		 WHERE i.id = $1`,
		[id],
	);
	if (result.rows.length === 0) return null;
	return result.rows[0] as InvitationInfo;
}, 'invitation-info');

/**
 * Clean up the currently authenticated user's account.
 * Only deletes if the user is NOT a member of any organization,
 * preventing abuse against established accounts.
 */
export async function cleanupOrphanedAccount(): Promise<void> {
	'use server';
	const { auth } = await import('~/server/auth');
	const { getWebRequest } = await import('@solidjs/start/http');
	const session = await auth.api.getSession({ headers: getWebRequest().headers });
	if (!session) return;
	const userId = session.user.id;
	// Only delete if the user has no org membership (orphaned signup)
	const memberCheck = await pool.query('SELECT 1 FROM member WHERE "userId" = $1 LIMIT 1', [userId]);
	if (memberCheck.rows.length > 0) return;
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query('DELETE FROM session WHERE "userId" = $1', [userId]);
		await client.query('DELETE FROM account WHERE "userId" = $1', [userId]);
		await client.query('DELETE FROM "user" WHERE id = $1', [userId]);
		await client.query('COMMIT');
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	} finally {
		client.release();
	}
}
