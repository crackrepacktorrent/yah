import { describe, expect, mock, test } from 'bun:test';
import { handlePublicAuthRequest } from './public-auth-boundary';

describe('public Better Auth boundary', () => {
	for (const [method, pathname] of [
		['POST', '/api/auth/organization/create-role'],
		['POST', '/api/auth/organization/update-role'],
		['POST', '/api/auth/organization/delete-role'],
		['POST', '/api/auth/organization/invite-member'],
		['POST', '/api/auth/organization/update-member-role'],
		['POST', '/api/auth/organization/remove-member'],
		['POST', '/api/auth/organization/cancel-invitation'],
		['POST', '/api/auth/organization/leave'],
		['GET', '/api/auth/organization/list-members'],
		['GET', '/api/auth/organization/list-invitations'],
		['GET', '/api/auth/organization/get-full-organization'],
		['GET', '/api/auth/organization/get-active-member-role'],
		['POST', '/api/auth/organization/has-permission'],
		['GET', '/api/auth/organization/list-roles'],
		['GET', '/api/auth/organization/get-role'],
		['POST', '/api/auth/organization/accept-invitation'],
		['GET', '/api/auth/organization/a-future-endpoint'],
	] as const) {
		test(`rejects direct ${method} ${pathname} requests before Better Auth runs`, async () => {
			const handler = mock(async () => new Response('forwarded'));
			const response = await handlePublicAuthRequest(
				new Request(`https://admin.example${pathname}/?attempt=bypass`, { method }),
				handler,
			);

			expect(response.status).toBe(404);
			expect(await response.text()).toBe('');
			expect(handler).not.toHaveBeenCalled();
		});
	}

	for (const pathname of ['/api/auth/get-session', '/api/auth/sign-in/email', '/api/auth/organization/set-active']) {
		test(`forwards the public auth route ${pathname}`, async () => {
			const expected = new Response('forwarded', { status: 202 });
			const handler = mock(async () => expected);
			const request = new Request(`https://admin.example${pathname}`, { method: 'POST' });

			expect(await handlePublicAuthRequest(request, handler)).toBe(expected);
			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(request);
		});
	}

	for (const pathname of [
		'/api/auth/organization',
		'/api/auth/organization/',
		'/api/auth/%6Frganization/list-members',
	]) {
		test(`normalizes and rejects the private organization route ${pathname}`, async () => {
			const handler = mock(async () => new Response('forwarded'));
			const response = await handlePublicAuthRequest(new Request(`https://admin.example${pathname}`), handler);

			expect(response.status).toBe(404);
			expect(handler).not.toHaveBeenCalled();
		});
	}
});
