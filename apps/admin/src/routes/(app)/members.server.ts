import { query } from "@solidjs/router";
import { getWebRequest } from "@solidjs/start/http";
import { auth } from "~/server/auth";
import {
  withPermissions,
  getSessionOrThrow,
  enforcePermissions,
  HttpError,
} from "~/server/auth-helpers";
import { emailSchema, nonEmptyStringSchema } from "~/lib/schemas";
import { rolesRequireAccessControl } from "@yah/admin-core/membership-policy";
import { parseMemberRoles, sameRoleSet } from "~/lib/role-permissions";
import { parseInput } from "~/server/validation";
import * as v from "valibot";

const memberIdSchema = v.pipe(nonEmptyStringSchema, v.maxLength(255));
const assignableRoleNameSchema = v.pipe(
  nonEmptyStringSchema,
  v.maxLength(128),
  v.check((role) => !role.includes(","), "Role names cannot contain commas.")
);
const assignableRolesSchema = v.pipe(
  v.array(assignableRoleNameSchema),
  v.minLength(1, "Assign at least one role."),
  v.maxLength(20, "At most 20 roles can be assigned."),
  v.transform((roles) => [...new Set(roles)])
);
const inviteMemberSchema = v.strictObject({
  email: emailSchema,
  roles: assignableRolesSchema,
});
const updateMemberRoleSchema = v.strictObject({
  memberId: memberIdSchema,
  roles: assignableRolesSchema,
});

async function validateAssignableRoles(roleNames: string[], allowOwner: boolean): Promise<void> {
  if (!allowOwner && roleNames.includes("owner"))
    throw new HttpError("Owner invitations are not supported.", 400);
  const dynamicRoleNames = roleNames.filter((role) => !["owner", "admin", "member"].includes(role));
  if (roleNames.includes("owner") || dynamicRoleNames.length > 0)
    await enforcePermissions({ ac: ["read"] });
  if (dynamicRoleNames.length === 0) return;

  const request = getWebRequest();
  const dynamicRoles = await auth.api.listOrgRoles({ headers: request.headers });
  const knownNames = new Set(dynamicRoles?.map((role) => role.role));
  const missing = dynamicRoleNames.filter((role) => !knownNames.has(role));
  if (missing.length > 0) throw new HttpError(`Role not found: ${missing.join(", ")}`, 404);
}

async function assertCanMutateMember(memberId: string, selfMessage: string): Promise<void> {
  const request = getWebRequest();
  const session = await getSessionOrThrow();
  const members = await auth.api.listMembers({ headers: request.headers });
  const member = members.members.find((candidate) => candidate.id === memberId);
  if (!member) throw new HttpError("Member not found", 404);
  if (member.userId === session.user.id) throw new HttpError(selfMessage, 400);
  if (rolesRequireAccessControl(member.role)) await enforcePermissions({ ac: ["read"] });
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listMembers = query(async () => {
  "use server";
  return withPermissions({ member: ["create"] }, async () => {
    const request = getWebRequest();
    const result = await auth.api.listMembers({ headers: request.headers });
    return result.members;
  });
}, "listMembers");

export const listInvitations = query(async () => {
  "use server";
  return withPermissions({ invitation: ["create"] }, async () => {
    const request = getWebRequest();
    return auth.api.listInvitations({ headers: request.headers });
  });
}, "listInvitations");

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function inviteMember(data: { email: string; roles: string[] }): Promise<void> {
  "use server";
  return withPermissions({ invitation: ["create"] }, async () => {
    const input = parseInput(inviteMemberSchema, data);
    await validateAssignableRoles(input.roles, false);
    const request = getWebRequest();
    const session = await getSessionOrThrow();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) throw new HttpError("No active organization", 400);
    const invitations = await auth.api.listInvitations({ headers: request.headers });
    const existing = invitations.find(
      (invitation) =>
        invitation.status === "pending" &&
        invitation.email.toLowerCase() === input.email.toLowerCase()
    );
    if (existing && !sameRoleSet(parseMemberRoles(existing.role), input.roles)) {
      throw new HttpError(
        `A pending invitation already exists with the ${existing.role} role. Cancel it before changing roles.`,
        409
      );
    }
    await auth.api.createInvitation({
      headers: request.headers,
      // Dynamic access control accepts arbitrary validated role names at runtime,
      // while Better Auth's generated server type only includes static roles.
      // Resending also recovers a persisted invitation whose first email send failed.
      body: {
        email: input.email,
        role: input.roles as Array<"member">,
        organizationId: orgId,
        resend: true,
      },
    });
  });
}

export async function updateMemberRole(data: { memberId: string; roles: string[] }): Promise<void> {
  "use server";
  return withPermissions({ member: ["update"] }, async () => {
    const input = parseInput(updateMemberRoleSchema, data);
    await assertCanMutateMember(input.memberId, "Cannot change your own roles");
    await validateAssignableRoles(input.roles, true);
    const request = getWebRequest();
    await auth.api.updateMemberRole({
      headers: request.headers,
      body: { memberId: input.memberId, role: input.roles as Array<"member"> },
    });
  });
}

export async function removeMember(memberId: string): Promise<void> {
  "use server";
  return withPermissions({ member: ["delete"] }, async () => {
    const validatedMemberId = parseInput(memberIdSchema, memberId);
    const request = getWebRequest();
    await assertCanMutateMember(validatedMemberId, "Cannot remove yourself");
    // Better Auth enforces: only owners can remove owners, can't remove last owner
    await auth.api.removeMember({
      headers: request.headers,
      body: { memberIdOrEmail: validatedMemberId },
    });
    // Removing an organization member must not delete their global account.
    // The same identity may belong to another organization or be invited again.
  });
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  "use server";
  return withPermissions({ invitation: ["cancel"] }, async () => {
    const request = getWebRequest();
    await auth.api.cancelInvitation({
      headers: request.headers,
      body: { invitationId: parseInput(memberIdSchema, invitationId) },
    });
  });
}
