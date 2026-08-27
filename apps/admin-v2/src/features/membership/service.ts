import { rolesRequireAccessControl } from '@yah/admin-core/membership-policy';
import { getBuiltInRolePermissions, type Permissions } from '@yah/admin-core/permissions';
import { parseMemberRoles, sameRoleSet } from '@yah/admin-core/role-permissions';
import * as v from 'valibot';
import {
	CancelInvitationCommandSchema,
	InviteMemberCommandSchema,
	MemberIdSchema,
	MembershipRouteCapabilitySchema,
	RemoveMemberCommandSchema,
	UpdateMemberRolesCommandSchema,
	type AdminMember,
	type CancelInvitationCommand,
	type InviteMemberCommand,
	type MembershipRouteCapability,
	type PendingAdminInvitation,
	type RemoveMemberCommand,
	type UpdateMemberRolesCommand,
} from './contracts';
import { createPublicError } from '~/platform/errors';

export type DirectoryMember = {
	id: string;
	userId: string;
	role: string | null;
	user: {
		name: string | null;
		email: string;
	};
};

export type DirectoryInvitation = {
	id: string;
	email: string;
	role: string | null;
	status: string;
	expiresAt: Date | string;
};

/**
 * Provider-neutral membership operations. In particular, removing a member
 * removes only the organization membership and never the global user account.
 */
export type MembershipDirectory = {
	listMembers(): Promise<DirectoryMember[]>;
	getMember(memberId: string): Promise<DirectoryMember | null>;
	listInvitations(): Promise<DirectoryInvitation[]>;
	listCustomRoleNames(): Promise<string[]>;
	invite(input: { email: string; roles: string[]; resend: true }): Promise<void>;
	updateMemberRoles(input: { memberId: string; roles: string[] }): Promise<void>;
	removeMembership(memberId: string): Promise<void>;
	cancelInvitation(invitationId: string): Promise<void>;
};

export type MembershipServiceDependencies = {
	enforcePermissions(headers: Headers, permissions: Permissions): Promise<void>;
	getCurrentUserId(headers: Headers): Promise<string>;
	directory: MembershipDirectory;
};

function parse<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
	schema: TSchema,
	input: unknown,
): v.InferOutput<TSchema> {
	const result = v.safeParse(schema, input);
	if (!result.success) throw createPublicError(result.issues[0]?.message ?? 'Invalid membership data.', 400);
	return result.output;
}

function normalizeEmail(email: string): string {
	return email.trim();
}

function comparableEmail(email: string): string {
	return normalizeEmail(email).toLowerCase();
}

function normalizeMember(member: DirectoryMember, currentUserId: string): AdminMember {
	return {
		id: member.id,
		name: member.user.name?.trim() || null,
		email: normalizeEmail(member.user.email),
		roles: parseMemberRoles(member.role),
		isSelf: member.userId === currentUserId,
	};
}

function normalizeInvitation(invitation: DirectoryInvitation): PendingAdminInvitation {
	const expiration = invitation.expiresAt instanceof Date ? invitation.expiresAt : new Date(invitation.expiresAt);
	if (Number.isNaN(expiration.getTime())) throw createPublicError('Invitation data is unavailable.', 500);
	return {
		id: invitation.id,
		email: normalizeEmail(invitation.email),
		roles: parseMemberRoles(invitation.role),
		expiresAt: expiration.toISOString(),
	};
}

async function validateKnownRoles(
	roles: string[],
	headers: Headers,
	dependencies: MembershipServiceDependencies,
	requireRoleAuthority = false,
): Promise<void> {
	const customRoles = roles.filter((role) => !getBuiltInRolePermissions(role));
	if (!requireRoleAuthority && customRoles.length === 0) return;

	await dependencies.enforcePermissions(headers, { ac: ['read'] });
	if (customRoles.length === 0) return;
	const knownRoles = new Set(await dependencies.directory.listCustomRoleNames());
	const unknownRoles = customRoles.filter((role) => !knownRoles.has(role));
	if (unknownRoles.length > 0) throw createPublicError(`Role not found: ${unknownRoles.join(', ')}`, 404);
}

async function getTargetMember(
	memberId: string,
	dependencies: MembershipServiceDependencies,
): Promise<DirectoryMember> {
	const member = await dependencies.directory.getMember(memberId);
	if (!member) throw createPublicError('Member not found.', 404);
	return member;
}

export async function listAuthorizedMembers(
	headers: Headers,
	dependencies: MembershipServiceDependencies,
): Promise<AdminMember[]> {
	await dependencies.enforcePermissions(headers, { member: ['create'] });
	const currentUserId = await dependencies.getCurrentUserId(headers);
	const members = await dependencies.directory.listMembers();
	return members.map((member) => normalizeMember(member, currentUserId));
}

export async function listAuthorizedPendingInvitations(
	headers: Headers,
	dependencies: MembershipServiceDependencies,
): Promise<PendingAdminInvitation[]> {
	await dependencies.enforcePermissions(headers, { invitation: ['create'] });
	const invitations = await dependencies.directory.listInvitations();
	return invitations.filter((invitation) => invitation.status === 'pending').map(normalizeInvitation);
}

export async function requireAuthorizedMembershipRouteCapability(
	input: unknown,
	headers: Headers,
	dependencies: MembershipServiceDependencies,
): Promise<true> {
	const capability = parse(MembershipRouteCapabilitySchema, input);
	const permissions: Record<MembershipRouteCapability, Permissions> = {
		invite: { invitation: ['create'] },
		edit: { member: ['update'] },
	};
	await dependencies.enforcePermissions(headers, permissions[capability]);
	return true;
}

export async function readAuthorizedMemberForRoleEdit(
	input: unknown,
	headers: Headers,
	dependencies: MembershipServiceDependencies,
): Promise<AdminMember> {
	const memberId = parse(MemberIdSchema, input);
	await dependencies.enforcePermissions(headers, { member: ['update'] });
	const currentUserId = await dependencies.getCurrentUserId(headers);
	const member = await getTargetMember(memberId, dependencies);
	if (member.userId === currentUserId) throw createPublicError('You cannot change your own roles.', 400);
	if (rolesRequireAccessControl(member.role ?? '')) await dependencies.enforcePermissions(headers, { ac: ['read'] });
	return normalizeMember(member, currentUserId);
}

export async function inviteAuthorizedMember(
	input: InviteMemberCommand,
	headers: Headers,
	dependencies: MembershipServiceDependencies,
): Promise<void> {
	const command = parse(InviteMemberCommandSchema, input);
	if (command.roles.includes('owner')) throw createPublicError('Owner invitations are not supported.', 400);

	await dependencies.enforcePermissions(headers, { invitation: ['create'] });
	await validateKnownRoles(command.roles, headers, dependencies);

	const invitations = await dependencies.directory.listInvitations();
	const existing = invitations.find(
		(invitation) =>
			invitation.status === 'pending' && comparableEmail(invitation.email) === comparableEmail(command.email),
	);
	if (existing && !sameRoleSet(parseMemberRoles(existing.role), command.roles)) {
		throw createPublicError(
			'A pending invitation already exists with different roles. Cancel it before changing roles.',
			409,
		);
	}

	await dependencies.directory.invite({ email: command.email, roles: command.roles, resend: true });
}

export async function updateAuthorizedMemberRoles(
	input: UpdateMemberRolesCommand,
	headers: Headers,
	dependencies: MembershipServiceDependencies,
): Promise<void> {
	const command = parse(UpdateMemberRolesCommandSchema, input);
	await dependencies.enforcePermissions(headers, { member: ['update'] });
	const currentUserId = await dependencies.getCurrentUserId(headers);
	const member = await getTargetMember(command.memberId, dependencies);
	if (member.userId === currentUserId) throw createPublicError('You cannot change your own roles.', 400);
	await validateKnownRoles(
		command.roles,
		headers,
		dependencies,
		rolesRequireAccessControl(member.role ?? '') || command.roles.includes('owner'),
	);
	await dependencies.directory.updateMemberRoles(command);
}

export async function removeAuthorizedMember(
	input: RemoveMemberCommand,
	headers: Headers,
	dependencies: MembershipServiceDependencies,
): Promise<void> {
	const command = parse(RemoveMemberCommandSchema, input);
	await dependencies.enforcePermissions(headers, { member: ['delete'] });
	const currentUserId = await dependencies.getCurrentUserId(headers);
	const member = await getTargetMember(command.memberId, dependencies);
	if (member.userId === currentUserId) throw createPublicError('You cannot remove yourself.', 400);
	if (rolesRequireAccessControl(member.role ?? '')) await dependencies.enforcePermissions(headers, { ac: ['read'] });
	await dependencies.directory.removeMembership(command.memberId);
}

export async function cancelAuthorizedInvitation(
	input: CancelInvitationCommand,
	headers: Headers,
	dependencies: MembershipServiceDependencies,
): Promise<void> {
	const command = parse(CancelInvitationCommandSchema, input);
	await dependencies.enforcePermissions(headers, { invitation: ['cancel'] });
	await dependencies.directory.cancelInvitation(command.invitationId);
}
