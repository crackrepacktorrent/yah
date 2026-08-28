import { describe, expect, it, vi } from 'vitest';
import { createListmonkEmailLogManager, redactEmailLogLine } from './email-log-manager.server';

const config = { LISTMONK_URL: 'https://mail.example/', LISTMONK_API_TOKEN: 'admin:secret-token' };
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

describe('Listmonk email log manager', () => {
	it('paginates the fixed upstream ring buffer newest-first without reversing lines', async () => {
		const lines = Array.from({ length: 450 }, (_, index) => `line ${index + 1}`);
		const request = vi.fn(async (_input: string | URL, _init: RequestInit = {}) => json({ data: lines }));
		const manager = createListmonkEmailLogManager(config, request);

		await expect(manager.list({ page: 1 })).resolves.toMatchObject({
			lines: lines.slice(250), total: 450, page: 1, requestedPage: 1, pageSize: 200,
		});
		await expect(manager.list({ page: 2 })).resolves.toMatchObject({ lines: lines.slice(50, 250), page: 2 });
		await expect(manager.list({ page: 9 })).resolves.toMatchObject({ lines: lines.slice(0, 50), page: 3, requestedPage: 9 });
		expect(String(request.mock.calls[0]?.[0])).toBe('https://mail.example/api/logs');
	});

	it('redacts common credentials while retaining useful diagnostics', () => {
		expect(redactEmailLogLine('connect postgres://yah:hunter2@db/yah password=secret authorization: Bearer abc.def'))
			.toBe('connect postgres://yah:[REDACTED]@db/yah password=[REDACTED] authorization: Bearer [REDACTED]');
		expect(redactEmailLogLine('LISTMONK_API_TOKEN="token with spaces" BETTER_AUTH_SECRET=super-secret password=\'quoted value\''))
			.toBe('LISTMONK_API_TOKEN=[REDACTED] BETTER_AUTH_SECRET=[REDACTED] password=[REDACTED]');
	});

	it('fails closed on oversized or non-string provider entries', async () => {
		const manager = createListmonkEmailLogManager(config, vi.fn(async () => json({ data: [42] })));
		await expect(manager.list({ page: 1 })).rejects.toThrow('invalid log response');
	});
});
