import type { APIHandler } from 'filesystem-routing/api';
import { env } from 'virtual:env/server';
import { handlePublicAuthRequest } from '@yah/admin-core/public-auth-boundary';

const handleAuth: APIHandler = async ({ request }) => {
	if (env.ADMIN_V2_RUNTIME === 'production') {
		return handlePublicAuthRequest(request, async (forwardedRequest) => {
			const { auth } = await import('~/platform/auth/production-server');
			return auth.handler(forwardedRequest);
		});
	}
	return new Response(null, { status: 404 });
};

// Better Auth's HTTP surface is GET/POST. The middleware boundary rejects every
// other method before filesystem-routing can fall through to the CSR document.
export const GET = handleAuth;
export const POST = handleAuth;
