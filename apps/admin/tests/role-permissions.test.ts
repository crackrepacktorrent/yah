import { describe, expect, test } from "bun:test";
import {
  mergePermissionSets,
  parseMemberRoles,
  parseStoredPermissionSet,
  sameRoleSet,
} from "../src/lib/role-permissions";
import { getBuiltInRolePermissions, isPermissionResource } from "../src/lib/permissions";

describe("organization role permissions", () => {
  test("parses and de-duplicates Better Auth multi-role values", () => {
    expect(parseMemberRoles("admin, editor,admin")).toEqual(["admin", "editor"]);
  });

  test("handles members without an assigned role", () => {
    expect(parseMemberRoles(null)).toEqual([]);
  });

  test("compares role assignments without depending on order", () => {
    expect(sameRoleSet(["editor", "analyst"], ["analyst", "editor"])).toBe(true);
    expect(sameRoleSet(["editor"], ["editor", "analyst"])).toBe(false);
  });

  test("unions actions from every assigned role", () => {
    expect(
      mergePermissionSets([{ campaign: ["view"], list: ["view"] }, { campaign: ["view", "edit"] }])
    ).toEqual({
      campaign: ["view", "edit"],
      list: ["view"],
    });
  });

  test("parses the dynamic-role storage format and rejects malformed shapes", () => {
    expect(parseStoredPermissionSet('{"campaign":["view"]}')).toEqual({ campaign: ["view"] });
    expect(() => parseStoredPermissionSet("[]")).toThrow();
    expect(() => parseStoredPermissionSet('{"campaign":"view"}')).toThrow();
  });

  test("does not confuse inherited object keys with built-in roles or permission resources", () => {
    expect(getBuiltInRolePermissions("owner")).toBeDefined();
    expect(getBuiltInRolePermissions("constructor")).toBeUndefined();
    expect(getBuiltInRolePermissions("__proto__")).toBeUndefined();
    expect(isPermissionResource("campaign")).toBe(true);
    expect(isPermissionResource("constructor")).toBe(false);
  });
});
