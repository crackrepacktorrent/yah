const organizationAuthPrefix = '/api/auth/organization';
const publicOrganizationAuthPaths = new Set([`${organizationAuthPrefix}/set-active`]);

type AuthHandler = (request: Request) => Response | Promise<Response>;

function normalizedPathname(request: Request): string {
	const pathname = new URL(request.url).pathname;
	let decodedPathname = pathname;
	try {
		decodedPathname = decodeURIComponent(pathname);
	} catch {
		// A malformed escape cannot match the sole public organization endpoint.
	}
	return decodedPathname.replace(/\/+$/, '').toLowerCase();
}

/**
 * Keep Better Auth's organization API private by default. Browser flows need
 * only set-active; trusted server-side auth.api calls do not cross this route.
 */
export async function handlePublicAuthRequest(request: Request, handler: AuthHandler): Promise<Response> {
	const pathname = normalizedPathname(request);
	if (
		(pathname === organizationAuthPrefix || pathname.startsWith(`${organizationAuthPrefix}/`)) &&
		!publicOrganizationAuthPaths.has(pathname)
	) {
		return new Response(null, { status: 404 });
	}
	return handler(request);
}
