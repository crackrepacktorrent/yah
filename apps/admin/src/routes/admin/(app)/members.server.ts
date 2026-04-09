import { query } from '@solidjs/router';
import { getWebRequest } from '@solidjs/start/http';
import { auth, pool } from '~/server/auth';
import { withPermissions, getSessionOrThrow, HttpError } from '~/server/auth-helpers';

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listMembers = query(async () => {
	'use server';
	return withPermissions({ member: ['create'] }, async () => {
		const request = getWebRequest();
		const result = await auth.api.listMembers({ headers: request.headers });
		return result.members;
	});
}, 'listMembers');

export const listInvitations = query(async () => {
	'use server';
	return withPermissions({ member: ['create'] }, async () => {
		const request = getWebRequest();
		return auth.api.listInvitations({ headers: request.headers });
	});
}, 'listInvitations');

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function inviteMember(data: { email: string; role: 'admin' | 'member' }): Promise<void> {
	'use server';
	return withPermissions({ member: ['create'] }, async () => {
		const request = getWebRequest();
		const session = await getSessionOrThrow();
		const orgId = session.session.activeOrganizationId;
		if (!orgId) throw new HttpError('No active organization', 400);
		await auth.api.createInvitation({
			headers: request.headers,
			body: { email: data.email, role: data.role, organizationId: orgId },
		});
	});
}

export async function updateMemberRole(data: { memberId: string; role: 'owner' | 'admin' | 'member' }): Promise<void> {
	'use server';
	return withPermissions({ member: ['update'] }, async () => {
		const request = getWebRequest();
		await auth.api.updateMemberRole({ headers: request.headers, body: { memberId: data.memberId, role: data.role } });
	});
}

export async function removeMember(memberId: string): Promise<void> {
	'use server';
	return withPermissions({ member: ['delete'] }, async () => {
		const request = getWebRequest();
		const session = await getSessionOrThrow();
		const members = await auth.api.listMembers({ headers: request.headers });
		const member = members.members.find((m) => m.id === memberId);
		if (!member) throw new HttpError('Member not found', 404);
		if (member.userId === session.user.id) throw new HttpError('Cannot remove yourself', 400);
		// Better Auth enforces: only owners can remove owners, can't remove last owner
		await auth.api.removeMember({ headers: request.headers, body: { memberIdOrEmail: memberId } });
		// Delete user account in a transaction
		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			await client.query('DELETE FROM session WHERE "userId" = $1', [member.userId]);
			await client.query('DELETE FROM account WHERE "userId" = $1', [member.userId]);
			await client.query('DELETE FROM "user" WHERE id = $1', [member.userId]);
			await client.query('COMMIT');
		} catch (err) {
			await client.query('ROLLBACK');
			throw err;
		} finally {
			client.release();
		}
	});
}

export async function cancelInvitation(invitationId: string): Promise<void> {
	'use server';
	return withPermissions({ invitation: ['cancel'] }, async () => {
		const request = getWebRequest();
		await auth.api.cancelInvitation({ headers: request.headers, body: { invitationId } });
	});
}
