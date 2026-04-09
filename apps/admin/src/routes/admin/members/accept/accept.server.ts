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
