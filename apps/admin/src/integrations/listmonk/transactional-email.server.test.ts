import { afterEach, describe, expect, it, vi } from 'vitest';
import { createListmonkTransactionalMailer } from './transactional-email.server';

afterEach(() => vi.unstubAllGlobals());

describe('Listmonk transactional mail boundary', () => {
	it('uses token authentication and the external-subscriber transaction contract', async () => {
		const requests: Array<[string | URL | Request, RequestInit | undefined]> = [];
		const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			requests.push([input, init]);
			return new Response(JSON.stringify({ data: true }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			});
		});
		vi.stubGlobal('fetch', fetchMock);

		const mailer = createListmonkTransactionalMailer({
			LISTMONK_URL: 'https://mail.example',
			LISTMONK_API_TOKEN: 'admin:secret-token',
		});
		await mailer.send({
			subscriberEmail: 'owner@example.com',
			templateId: 7,
			data: { access_link: 'https://admin.example/link' },
		});

		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = requests[0]!;
		expect(url).toBe('https://mail.example/api/tx');
		expect(init).toMatchObject({
			method: 'POST',
			headers: {
				Authorization: 'token admin:secret-token',
				'Content-Type': 'application/json',
			},
		});
		expect(JSON.parse(String(init?.body))).toEqual({
			subscriber_email: 'owner@example.com',
			subscriber_mode: 'external',
			template_id: 7,
			data: { access_link: 'https://admin.example/link' },
			content_type: 'html',
		});
	});

	it('retains only the bounded upstream diagnostic prefix', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('x'.repeat(3_000), { status: 502, statusText: 'Bad Gateway' })),
		);

		const mailer = createListmonkTransactionalMailer({
			LISTMONK_URL: 'https://mail.example',
			LISTMONK_API_TOKEN: 'admin:secret-token',
		});

		await expect(mailer.send({ subscriberEmail: 'owner@example.com', templateId: 7 })).rejects.toThrow(
			/Listmonk transactional email failed \(502\): x{2000}$/,
		);
	});
});
