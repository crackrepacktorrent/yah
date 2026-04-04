import { query, redirect } from "@solidjs/router";
import { getWebRequest } from "@solidjs/start/http";
import { auth } from "~/server/auth";
import { defaultRolePermissions } from "~/lib/permissions";
export type Session = {
  user: {
    name: string | null;
    email: string;
    image: string | null | undefined;
  };
  role: string | null;
  permissions: Record<string, string[]>;
};

async function fetchSession(headers: Headers): Promise<Session | null> {
  const [session, activeMember] = await Promise.all([
    auth.api.getSession({ headers }),
    auth.api.getActiveMember({ headers }).catch(() => null),
  ]);

  if (!session) return null;

  const role = (activeMember?.role as string) ?? null;

  let permissions: Record<string, string[]> = {};
  if (role) {
    if (defaultRolePermissions[role]) {
      permissions = defaultRolePermissions[role]!;
    } else {
      try {
        const dynamicRole = await auth.api.getOrgRole({
          headers,
          query: { roleName: role },
        });
        if (dynamicRole?.permission) {
          permissions = dynamicRole.permission;
        }
      } catch {
        // Role not found — no permissions
      }
    }
  }

  return {
    user: {
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    },
    role,
    permissions,
  };
}

export const getSession = query(async (): Promise<Session | null> => {
  "use server";
  return fetchSession(getWebRequest().headers);
}, "session");

export const requireSession = query(async (): Promise<Session> => {
  "use server";
  const session = await fetchSession(getWebRequest().headers);
  if (!session) throw redirect("/admin/login");
  return session;
}, "require-session");
