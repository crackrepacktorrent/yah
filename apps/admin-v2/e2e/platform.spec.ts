import { expect, test } from '@playwright/test';

/**
 * The default runtime must fail closed. This is the only suite that boots the
 * built server in `platform-disabled` mode, so it is the sole proof that the
 * deployment entry mounts no static middleware and that the runtime guard
 * refuses everything but health before any handler runs.
 */
test('platform-disabled mode exposes health and rejects everything else', async ({ request }) => {
	const health = await request.get('/api/health');
	expect(health.status()).toBe(200);
	expect(await health.json()).toEqual({ app: 'yah-admin-v2', status: 'ok' });

	const head = await request.head('/api/health');
	expect(head.status()).toBe(200);
	expect(await head.body()).toHaveLength(0);

	for (const path of [
		'/',
		'/index.html',
		'/login',
		'/static-probe.txt',
		'/logo.svg',
		'/api/auth/get-session',
		'/_server',
		'/not-a-route',
	]) {
		const response = await request.get(path);
		expect(response.status(), path).toBe(404);
	}

	const authPost = await request.post('/api/auth/sign-in/email', { data: {} });
	expect(authPost.status()).toBe(404);
});
