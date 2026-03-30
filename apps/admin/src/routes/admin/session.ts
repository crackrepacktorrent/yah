import { query } from "@solidjs/router";
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

// Returns the session if authenticated, null if not.
// Redirects are handled client-side in the layout to avoid a SolidStart alpha.2
// bug where thrown redirect() Responses crash Seroval serialization in production.
export const requireSession = query(async (): Promise<Session | null> => {
  "use server";
  return fetchSession(getWebRequest().headers);
}, "require-session");

// Returns true if the visitor is a guest (not logged in), false if authenticated.
// Auth-page redirect is handled client-side for the same reason as above.
export const checkGuest = query(async (): Promise<boolean> => {
  "use server";
  const session = await auth.api.getSession({ headers: getWebRequest().headers });
  return session === null;
}, "guest");
