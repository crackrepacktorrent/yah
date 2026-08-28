import type { FetchMiddleware } from '@solidjs/web';
import { decodeCampaignRouteId } from '~/features/campaigns/routing';
import { decodeEmailTemplateRouteId } from '~/features/email-templates/routing';
import { decodeMailingListRouteId } from '~/features/mailing-lists/routing';
import { decodeMemberRouteId } from '~/features/membership/routing';
import { decodeRoleRouteId } from '~/features/roles/routing';
import { decodeShortlinkRouteCode } from '~/features/shortlinks/routing';
import { decodeSubscriberRouteId } from '~/features/subscribers/routing';

export type AdminV2Runtime = 'production' | 'platform-disabled';

function hasPathPrefix(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isAuthApi(pathname: string): boolean {
	return hasPathPrefix(pathname, '/api/auth');
}

function isShortlinkManagementPage(pathname: string): boolean {
	const match = pathname.match(/^\/shortlinks\/([^/]+)\/(?:details|edit)$/);
	return !!match?.[1] && decodeShortlinkRouteCode(match[1]) !== '';
}

function isRoleManagementPage(pathname: string): boolean {
	const match = pathname.match(/^\/roles\/([^/]+)\/(?:edit|clone)$/);
	return !!match?.[1] && decodeRoleRouteId(match[1]) !== '';
}

function isMemberRolePage(pathname: string): boolean {
	const match = pathname.match(/^\/members\/([^/]+)\/roles$/);
	return !!match?.[1] && decodeMemberRouteId(match[1]) !== '';
}

function isEmailTemplatePage(pathname: string): boolean {
	const match = pathname.match(/^\/emails\/templates\/([^/]+)$/);
	return !!match?.[1] && decodeEmailTemplateRouteId(match[1]) > 0;
}

function isMailingListPage(pathname: string): boolean {
	const match = pathname.match(/^\/emails\/lists\/([^/]+)$/);
	return !!match?.[1] && decodeMailingListRouteId(match[1]) > 0;
}

function isCampaignPage(pathname: string): boolean {
	const match = pathname.match(/^\/emails\/campaigns\/([^/]+)$/);
	return !!match?.[1] && decodeCampaignRouteId(match[1]) > 0;
}

function isSubscriberPage(pathname: string): boolean {
	const match = pathname.match(/^\/emails\/subscribers\/([^/]+)$/);
	return !!match?.[1] && decodeSubscriberRouteId(match[1]) > 0;
}

function isProductPage(pathname: string): boolean {
	// Solid Router ignores one trailing slash when matching direct loads.
	if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
	return (
		pathname === '/' ||
		pathname === '/analytics' ||
		pathname === '/shortlinks' ||
		pathname === '/shortlinks/new' ||
		isShortlinkManagementPage(pathname) ||
		pathname === '/emails' ||
		pathname === '/emails/templates/new' ||
		isEmailTemplatePage(pathname) ||
		pathname === '/emails/lists' ||
		pathname === '/emails/lists/new' ||
		isMailingListPage(pathname) ||
		pathname === '/emails/forms' ||
		pathname === '/emails/campaigns' ||
		pathname === '/emails/campaigns/new' ||
		isCampaignPage(pathname) ||
		pathname === '/emails/analytics' ||
		pathname === '/emails/subscribers' ||
		pathname === '/emails/subscribers/new' ||
		isSubscriberPage(pathname) ||
		pathname === '/emails/bounces' ||
		pathname === '/emails/logs' ||
		pathname === '/settings/email' ||
		pathname === '/settings/email/general' ||
		pathname === '/settings/email/performance' ||
		pathname === '/settings/email/bounces' ||
		pathname === '/settings/email/privacy' ||
		pathname === '/settings/email/provider' ||
		pathname === '/roles' ||
		pathname === '/roles/new' ||
		isRoleManagementPage(pathname) ||
		pathname === '/members' ||
		pathname === '/members/invitations/new' ||
		isMemberRolePage(pathname) ||
		pathname === '/login' ||
		pathname === '/forgot-password' ||
		pathname === '/reset-password' ||
		/^\/members\/accept\/[^/]+$/.test(pathname)
	);
}

function methodNotAllowed(allowed: string): Response {
	return new Response(null, { status: 405, headers: { allow: allowed } });
}

/**
 * Disabled mode exposes only health. Production exposes only completed
 * product slices, their server-function transport, and the real auth API.
 * Every callable function still owns its runtime, validation, and auth checks.
 */
export function createAdminRuntimeGuard(runtime: AdminV2Runtime): FetchMiddleware {
	return (request, next) => {
		const { pathname } = new URL(request.url);
		if (runtime === 'platform-disabled' && pathname !== '/api/health') {
			return new Response(null, { status: 404 });
		}
		if (runtime === 'production') {
			const allowed = pathname === '/api/health' || isAuthApi(pathname) || pathname === '/_server' || isProductPage(pathname);
			if (!allowed) return new Response(null, { status: 404 });

			if (isProductPage(pathname) && request.method !== 'GET' && request.method !== 'HEAD') {
				return methodNotAllowed('GET, HEAD');
			}
			if (pathname === '/_server' && request.method !== 'GET' && request.method !== 'POST') {
				return methodNotAllowed('GET, POST');
			}
		}

		if (isAuthApi(pathname) && request.method !== 'GET' && request.method !== 'POST') {
			return methodNotAllowed('GET, POST');
		}

		return next();
	};
}

/** Never let an unhandled API request fall through to the CSR document. */
export const rejectUnhandledApiRequests: FetchMiddleware = (request, next) => {
	const { pathname } = new URL(request.url);
	return pathname === '/api' || pathname.startsWith('/api/') ? Response.json({ error: 'Not found.' }, { status: 404 }) : next();
};
