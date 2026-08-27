import { query } from '@solidjs/router';
import type {
	AdminMember,
	CancelInvitationCommand,
	InviteMemberCommand,
	MembershipRouteCapability,
	PendingAdminInvitation,
	RemoveMemberCommand,
	UpdateMemberRolesCommand,
} from './contracts';
import {
	cancelAuthorizedInvitation,
	inviteAuthorizedMember,
	listAuthorizedMembers,
	listAuthorizedPendingInvitations,
	readAuthorizedMemberForRoleEdit,
	removeAuthorizedMember,
	requireAuthorizedMembershipRouteCapability,
	updateAuthorizedMemberRoles,
} from './service';
import { surfaceError } from '~/platform/errors';
import { getServerRequest } from '~/platform/request';
import { requireProductionRuntime } from '~/platform/runtime.server';

async function dependencies(headers: Headers) {
	const [{ enforcePermissions, requireCanonicalSession }, { createProductionMembershipDirectory }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/platform/auth/membership-directory.server'),
	]);
	return {
		enforcePermissions,
		getCurrentUserId: async (requestHeaders: Headers) => (await requireCanonicalSession(requestHeaders)).session.user.id,
		directory: createProductionMembershipDirectory(headers),
	};
}

export const listMembers = query(async (): Promise<AdminMember[]> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await listAuthorizedMembers(request.headers, await dependencies(request.headers));
	} catch (error) {
		surfaceError(error);
	}
}, 'members');

export const listPendingInvitations = query(async (): Promise<PendingAdminInvitation[]> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await listAuthorizedPendingInvitations(request.headers, await dependencies(request.headers));
	} catch (error) {
		surfaceError(error);
	}
}, 'pending-admin-invitations');

export const getMemberForRoleEdit = query(async (memberId: string): Promise<AdminMember> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await readAuthorizedMemberForRoleEdit(memberId, request.headers, await dependencies(request.headers));
	} catch (error) {
		surfaceError(error);
	}
}, 'member-role-edit');

export const requireMembershipRouteCapability = query(async (capability: MembershipRouteCapability): Promise<true> => {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		return await requireAuthorizedMembershipRouteCapability(capability, request.headers, await dependencies(request.headers));
	} catch (error) {
		surfaceError(error);
	}
}, 'membership-route-capability');

export async function inviteMember(command: InviteMemberCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await inviteAuthorizedMember(command, request.headers, await dependencies(request.headers));
	} catch (error) {
		surfaceError(error);
	}
}

export async function updateMemberRoles(command: UpdateMemberRolesCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await updateAuthorizedMemberRoles(command, request.headers, await dependencies(request.headers));
	} catch (error) {
		surfaceError(error);
	}
}

export async function removeMember(command: RemoveMemberCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await removeAuthorizedMember(command, request.headers, await dependencies(request.headers));
	} catch (error) {
		surfaceError(error);
	}
}

export async function cancelInvitation(command: CancelInvitationCommand): Promise<void> {
	'use server';
	const request = getServerRequest();
	try {
		requireProductionRuntime();
		await cancelAuthorizedInvitation(command, request.headers, await dependencies(request.headers));
	} catch (error) {
		surfaceError(error);
	}
}
