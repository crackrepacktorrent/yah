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
import { runProductionRequest } from '~/platform/production-request.server';

async function requestDependencies(headers: Headers) {
	const [{ createAuthorizationContext }, { createProductionMembershipDirectory }] = await Promise.all([
		import('~/platform/auth/authorization.server'),
		import('~/platform/auth/membership-directory.server'),
	]);
	return {
		authorization: createAuthorizationContext(headers),
		directory: createProductionMembershipDirectory(headers),
	};
}

export const listMembers = query(async (): Promise<AdminMember[]> => {
	'use server';
	return runProductionRequest(async (request) =>
		listAuthorizedMembers(await requestDependencies(request.headers)),
	);
}, 'members');

export const listPendingInvitations = query(async (): Promise<PendingAdminInvitation[]> => {
	'use server';
	return runProductionRequest(async (request) =>
		listAuthorizedPendingInvitations(await requestDependencies(request.headers)),
	);
}, 'pending-admin-invitations');

export const getMemberForRoleEdit = query(async (memberId: string): Promise<AdminMember> => {
	'use server';
	return runProductionRequest(async (request) =>
		readAuthorizedMemberForRoleEdit(memberId, await requestDependencies(request.headers)),
	);
}, 'member-role-edit');

export const requireMembershipRouteCapability = query(async (capability: MembershipRouteCapability): Promise<true> => {
	'use server';
	return runProductionRequest(async (request) =>
		requireAuthorizedMembershipRouteCapability(capability, await requestDependencies(request.headers)),
	);
}, 'membership-route-capability');

export async function inviteMember(command: InviteMemberCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) =>
		inviteAuthorizedMember(command, await requestDependencies(request.headers)),
	);
}

export async function updateMemberRoles(command: UpdateMemberRolesCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) =>
		updateAuthorizedMemberRoles(command, await requestDependencies(request.headers)),
	);
}

export async function removeMember(command: RemoveMemberCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) =>
		removeAuthorizedMember(command, await requestDependencies(request.headers)),
	);
}

export async function cancelInvitation(command: CancelInvitationCommand): Promise<void> {
	'use server';
	return runProductionRequest(async (request) =>
		cancelAuthorizedInvitation(command, await requestDependencies(request.headers)),
	);
}
