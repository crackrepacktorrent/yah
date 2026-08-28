import { auth } from "~/server/auth";
import { handlePublicAuthRequest } from "@yah/admin-core/public-auth-boundary";

const handleAuth = ({ request }: { request: Request }): Promise<Response> => {
  return handlePublicAuthRequest(request, auth.handler);
};

export const GET = handleAuth;
export const POST = handleAuth;
export const PUT = handleAuth;
export const PATCH = handleAuth;
export const DELETE = handleAuth;
