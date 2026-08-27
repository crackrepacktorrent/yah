import * as v from 'valibot';

const identifier = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(255));
const roleName = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, 'Role names cannot be empty.'),
	v.maxLength(128, 'Role names are too long.'),
	v.check((role) => !role.includes(','), 'Role names cannot contain commas.'),
);
const assignedRoles = v.pipe(
	v.array(roleName),
	v.minLength(1, 'Assign at least one role.'),
	v.maxLength(20, 'At most 20 roles can be assigned.'),
	v.transform((roles) => [...new Set(roles)]),
);

export const MemberIdSchema = identifier;
export const InvitationIdSchema = identifier;
export const AssignedRolesSchema = assignedRoles;
export const MembershipRouteCapabilitySchema = v.picklist(['invite', 'edit'] as const);
export const InviteMemberCommandSchema = v.strictObject({
	email: v.pipe(v.string(), v.trim(), v.email('Enter a valid email address.'), v.maxLength(254)),
	roles: assignedRoles,
});
export const UpdateMemberRolesCommandSchema = v.strictObject({
	memberId: identifier,
	roles: assignedRoles,
});
export const RemoveMemberCommandSchema = v.strictObject({ memberId: identifier });
export const CancelInvitationCommandSchema = v.strictObject({ invitationId: identifier });

export type InviteMemberCommand = v.InferInput<typeof InviteMemberCommandSchema>;
export type UpdateMemberRolesCommand = v.InferInput<typeof UpdateMemberRolesCommandSchema>;
export type RemoveMemberCommand = v.InferInput<typeof RemoveMemberCommandSchema>;
export type CancelInvitationCommand = v.InferInput<typeof CancelInvitationCommandSchema>;
export type MembershipRouteCapability = v.InferOutput<typeof MembershipRouteCapabilitySchema>;

/** The complete member shape intentionally exposed to admin UI consumers. */
export type AdminMember = {
	id: string;
	name: string | null;
	email: string;
	roles: string[];
	isSelf: boolean;
};

/** Only pending-status invitations cross the service boundary, so status is not exposed. */
export type PendingAdminInvitation = {
	id: string;
	email: string;
	roles: string[];
	expiresAt: string;
};
