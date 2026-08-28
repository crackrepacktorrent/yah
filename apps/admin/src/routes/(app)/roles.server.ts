import { query } from "@solidjs/router";
import { getWebRequest } from "@solidjs/start/http";
import { auth } from "~/server/auth";
import {
  customRoleStatements,
  defaultRolePermissions,
  isCustomRolePermissionResource,
} from "~/lib/permissions";
import { HttpError, withPermissions } from "~/server/auth-helpers";
import { nonEmptyStringSchema } from "~/lib/schemas";
import { parseInput } from "~/server/validation";
import * as v from "valibot";

const roleNameSchema = v.pipe(
  nonEmptyStringSchema,
  v.maxLength(128, "Role name is too long."),
  v.check((role) => !role.includes(","), "Role names cannot contain commas."),
  v.transform((role) => role.toLowerCase())
);
const permissionsSchema = v.record(
  v.pipe(v.string(), v.maxLength(128)),
  v.pipe(v.array(v.pipe(v.string(), v.maxLength(128))), v.maxLength(100))
);
const createRoleSchema = v.strictObject({ role: roleNameSchema, permissions: permissionsSchema });
const updateRoleSchema = v.pipe(
  v.strictObject({
    roleId: v.pipe(nonEmptyStringSchema, v.maxLength(255)),
    permissions: permissionsSchema,
  })
);
function validatePermissions(permissions: Record<string, string[]>): void {
  for (const [resource, actions] of Object.entries(permissions)) {
    if (!isCustomRolePermissionResource(resource))
      throw new HttpError(`Invalid request: Unknown permission resource "${resource}".`, 400);
    const allowedActions = customRoleStatements[resource] as readonly string[];
    for (const action of actions) {
      if (!allowedActions.includes(action)) {
        throw new HttpError(`Invalid request: Unknown ${resource} action "${action}".`, 400);
      }
    }
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export const listRoles = query(async () => {
  "use server";
  return withPermissions({ ac: ["read"] }, async () => {
    const request = getWebRequest();
    const dynamicRoles = await auth.api.listOrgRoles({ headers: request.headers });

    const builtIn = Object.entries(defaultRolePermissions).map(([name, permission]) => ({
      id: `builtin:${name}`,
      role: name,
      permission: permission as Record<string, string[]>,
      createdAt: new Date(0),
      builtIn: true as const,
    }));

    const custom = (dynamicRoles ?? []).map((r) => ({
      id: r.id,
      role: r.role,
      permission: (r.permission ?? {}) as Record<string, string[]>,
      createdAt: new Date(r.createdAt),
      builtIn: false as const,
    }));

    return { roles: [...builtIn, ...custom] };
  });
}, "listRoles");

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createRole(data: {
  role: string;
  permissions: Record<string, string[]>;
}): Promise<void> {
  "use server";
  return withPermissions({ ac: ["create"] }, async () => {
    const input = parseInput(createRoleSchema, data);
    validatePermissions(input.permissions);
    const request = getWebRequest();
    await auth.api.createOrgRole({
      headers: request.headers,
      body: { role: input.role, permission: input.permissions },
    });
  });
}

export async function updateRole(data: {
  roleId: string;
  permissions: Record<string, string[]>;
}): Promise<void> {
  "use server";
  return withPermissions({ ac: ["update"] }, async () => {
    const input = parseInput(updateRoleSchema, data);
    validatePermissions(input.permissions);
    const request = getWebRequest();
    await auth.api.updateOrgRole({
      headers: request.headers,
      // Role keys are immutable: Better Auth does not migrate existing
      // comma-separated member assignments when a role record is renamed.
      body: { roleId: input.roleId, data: { permission: input.permissions } },
    });
  });
}
