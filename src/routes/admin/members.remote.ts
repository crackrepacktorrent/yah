import { query, command } from '$app/server';
import * as v from 'valibot';
import { auth } from '$lib/server/auth';
import { getRequestEvent } from '$app/server';
import { requireRole, getSessionOrThrow } from '$lib/server/auth-helpers';

export const listMembers = query(async () => {
	await requireRole('owner');
	const event = getRequestEvent();

	const members = await auth.api.listMembers({
		headers: event.request.headers,
	});

	return { members };
});

export const listInvitations = query(async () => {
	await requireRole('owner');
	const event = getRequestEvent();

	const invitations = await auth.api.listInvitations({
		headers: event.request.headers,
	});

	return { invitations };
});

export const inviteMember = command(
	v.object({
		email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email')),
		role: v.picklist(['admin', 'member']),
	}),
	async ({ email, role }) => {
		await requireRole('owner');
		const event = getRequestEvent();

		await auth.api.createInvitation({
			headers: event.request.headers,
			body: {
				email,
				role,
				organizationId: await getOrgId(),
			},
		});
	},
);

export const updateMemberRole = command(
	v.object({
		memberId: v.string(),
		role: v.picklist(['owner', 'admin', 'member']),
	}),
	async ({ memberId, role }) => {
		await requireRole('owner');
		const event = getRequestEvent();

		await auth.api.updateMemberRole({
			headers: event.request.headers,
			body: {
				memberId,
				role,
			},
		});
	},
);

export const removeMember = command(
	v.string(),
	async (memberId) => {
		await requireRole('owner');
		const event = getRequestEvent();

		await auth.api.removeMember({
			headers: event.request.headers,
			body: {
				memberIdOrEmail: memberId,
			},
		});
	},
);

export const cancelInvitation = command(
	v.string(),
	async (invitationId) => {
		await requireRole('owner');
		const event = getRequestEvent();

		await auth.api.cancelInvitation({
			headers: event.request.headers,
			body: {
				invitationId,
			},
		});
	},
);

async function getOrgId(): Promise<string> {
	const session = await getSessionOrThrow();
	if (!session.session.activeOrganizationId) {
		throw new Error('No active organization');
	}
	return session.session.activeOrganizationId;
}
