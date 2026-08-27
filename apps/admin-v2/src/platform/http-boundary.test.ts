import { describe, expect, it, vi } from 'vitest';
import { createAdminRuntimeGuard, rejectUnhandledApiRequests } from './http-boundary';

const terminalResponse = new Response('next');

describe('admin HTTP boundary', () => {
	it('fails closed for all unfinished application traffic outside lab mode', async () => {
		const next = vi.fn(async () => terminalResponse);
		const guard = createAdminRuntimeGuard('platform-disabled');

		for (const path of ['/', '/compatibility/auth', '/compatibility/table', '/api/auth/get-session', '/api/adapter-probe', '/_server']) {
			const response = await guard(new Request(`https://admin.example${path}`), next);
			expect(response.status, path).toBe(404);
		}
		expect(next).not.toHaveBeenCalled();
	});

	it('allows only completed product slices in production mode', async () => {
		const next = vi.fn(async () => terminalResponse);
		const guard = createAdminRuntimeGuard('production');

		for (const path of [
			'/api/health',
			'/api/auth/get-session',
			'/_server',
			'/',
			'/analytics',
			'/shortlinks',
			'/shortlinks/new',
			'/shortlinks/~h70726573732d6b6974/details',
			'/shortlinks/~h70726573732d6b6974/edit',
			'/shortlinks/~h6e6577/details',
			'/emails',
			'/emails/templates/new',
			'/emails/templates/42',
			'/emails/lists',
			'/emails/lists/new',
			'/emails/lists/42',
			'/emails/forms',
			'/emails/campaigns',
			'/emails/campaigns/new',
			'/emails/campaigns/42',
			'/emails/analytics',
			'/emails/subscribers',
			'/emails/subscribers/new',
			'/emails/subscribers/42',
			'/emails/bounces',
			'/roles',
			'/roles/new',
			'/roles/~h6275696c74696e3a6f776e6572/edit',
			'/roles/~h637573746f6d2d726f6c65/clone',
			'/members',
			'/members/invitations/new',
			'/members/~h6d656d6265722d31/roles',
			'/login',
			'/forgot-password',
			'/reset-password',
			'/members/accept/invitation-id',
		]) {
			expect(await guard(new Request(`https://admin.example${path}`), next), path).toBe(terminalResponse);
		}
		for (const path of [
			'/index.html',
			'/compatibility/auth',
			'/members/accept',
			'/shortlinks/press-kit/details',
			'/shortlinks/~h70726573732d6b6974/unknown',
			'/shortlinks/~h1/details',
			'/shortlinks/~hFF/edit',
			'/shortlinks/~h80/details',
			'/emails/templates/0',
			'/emails/templates/01',
			'/emails/templates/not-an-id',
			'/emails/templates/42/edit',
			'/emails/lists/0',
			'/emails/lists/01',
			'/emails/lists/not-an-id',
			'/emails/lists/42/edit',
			'/emails/forms/extra',
			'/emails/campaigns/0',
			'/emails/campaigns/01',
			'/emails/campaigns/not-an-id',
			'/emails/campaigns/42/edit',
			'/emails/subscribers/0',
			'/emails/subscribers/01',
			'/emails/subscribers/not-an-id',
			'/emails/subscribers/42/edit',
			'/roles/custom-role/edit',
			'/roles/~h1/clone',
			'/roles/~hFF/edit',
			'/members/member-1/roles',
			'/members/~h80/roles',
			'/members/invitations/extra/new',
			'/api/adapter-probe',
		]) {
			expect((await guard(new Request(`https://admin.example${path}`), next)).status, path).toBe(404);
		}
	});

	it('limits production page and server-function methods', async () => {
		const next = vi.fn(async () => terminalResponse);
		const guard = createAdminRuntimeGuard('production');

		const pageResponse = await guard(new Request('https://admin.example/login', { method: 'POST' }), next);
		expect(pageResponse.status).toBe(405);
		expect(pageResponse.headers.get('allow')).toBe('GET, HEAD');

		const serverFunctionResponse = await guard(new Request('https://admin.example/_server', { method: 'DELETE' }), next);
		expect(serverFunctionResponse.status).toBe(405);
		expect(serverFunctionResponse.headers.get('allow')).toBe('GET, POST');
	});

	it('allows lab GET and POST auth traffic but rejects every other method', async () => {
		const next = vi.fn(async () => terminalResponse);
		const guard = createAdminRuntimeGuard('compatibility-lab');

		for (const method of ['GET', 'POST']) {
			const response = await guard(new Request('https://admin.example/api/auth/session', { method }), next);
			expect(response, method).toBe(terminalResponse);
		}

		for (const method of ['HEAD', 'OPTIONS', 'PUT', 'PATCH', 'DELETE', 'PROPFIND']) {
			const response = await guard(new Request('https://admin.example/api/auth/session', { method }), next);
			expect(response.status, method).toBe(405);
			expect(response.headers.get('allow'), method).toBe('GET, POST');
		}
	});

	it('turns unhandled API traffic into JSON 404 responses', async () => {
		const next = vi.fn(async () => terminalResponse);
		const response = await rejectUnhandledApiRequests(new Request('https://admin.example/api/unknown'), next);

		expect(response.status).toBe(404);
		expect(response.headers.get('content-type')).toContain('application/json');
		expect(await response.json()).toEqual({ error: 'Not found.' });
		expect(next).not.toHaveBeenCalled();
	});

	it('keeps the health route available in platform-disabled mode', async () => {
		const next = vi.fn(async () => terminalResponse);
		const guard = createAdminRuntimeGuard('platform-disabled');

		expect(await guard(new Request('https://admin.example/api/health'), next)).toBe(terminalResponse);
	});
});
