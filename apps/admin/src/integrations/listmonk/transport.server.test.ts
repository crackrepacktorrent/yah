import { describe, expect, it, vi } from 'vitest';
import { UpstreamProtocolError } from '~/integrations/http';
import { createListmonkTransport, ListmonkHttpFailure } from './transport.server';

const config = { LISTMONK_URL: 'https://mail.example/', LISTMONK_API_TOKEN: 'admin:secret-token' };

describe('Listmonk transport', () => {
	it('owns the API base URL, token authentication, and JSON headers', async () => {
		const requests: Array<{ input: string | URL; init?: RequestInit }> = [];
		const request = vi.fn(async (input: string | URL, init?: RequestInit) => {
			requests.push({ input, init });
			return new Response(JSON.stringify({ data: true }), { headers: { 'content-type': 'application/json' } });
		});
		const transport = createListmonkTransport(config, request);

		await expect(transport.json('/templates', { method: 'POST', body: '{}' })).resolves.toEqual({ data: true });
		expect(request).toHaveBeenCalledOnce();
		const recorded = requests[0]!;
		const headers = new Headers(recorded.init?.headers);
		expect(recorded.input).toBe('https://mail.example/api/templates');
		expect(headers.get('accept')).toBe('application/json');
		expect(headers.get('authorization')).toBe('token admin:secret-token');
		expect(headers.get('content-type')).toBe('application/json');
	});

	it('accepts the worst-case Go JSON expansion of an allowed 5 MB body', async () => {
		const encoded = `{"data":"${'\\u003c'.repeat(5_000_000)}"}`;
		const transport = createListmonkTransport(
			config,
			vi.fn(async () => new Response(encoded, { headers: { 'content-type': 'application/json' } })),
		);

		const response = await transport.json('/templates/7') as { data: string };
		expect(new TextEncoder().encode(response.data).byteLength).toBe(5_000_000);
	});

	it('drains only a bounded error prefix and exposes no provider diagnostic', async () => {
		let cancelled = false;
		let emitted = 0;
		const request = vi.fn(async () =>
			new Response(
				new ReadableStream({
					pull(controller) {
						emitted += 1;
						controller.enqueue(new TextEncoder().encode(`${config.LISTMONK_API_TOKEN}${'x'.repeat(1_500)}`));
					},
					cancel() {
						cancelled = true;
					},
				}),
				{ status: 502, headers: { 'content-type': 'text/plain' } },
			),
		);
		const transport = createListmonkTransport(config, request);

		const error = await transport.json('/templates').catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(ListmonkHttpFailure);
		expect(error).toMatchObject({ status: 502 });
		expect(String(error)).not.toContain(config.LISTMONK_API_TOKEN);
		expect(cancelled).toBe(true);
		expect(emitted).toBeLessThan(5);
	});

	it('accepts bounded HTML and rejects the wrong content type', async () => {
		const requests: Array<{ init?: RequestInit }> = [];
		const htmlRequest = vi.fn(async (_input: string | URL, init?: RequestInit) => {
			requests.push({ init });
			return new Response('<main>Preview</main>', { headers: { 'content-type': 'text/html; charset=UTF-8' } });
		});
		const transport = createListmonkTransport(config, htmlRequest);

		await expect(transport.html('/templates/2/preview')).resolves.toBe('<main>Preview</main>');
		expect(new Headers(requests[0]?.init?.headers).get('accept')).toBe('text/html');

		const wrongType = createListmonkTransport(
			config,
			vi.fn(async () => new Response('{}', { headers: { 'content-type': 'application/json' } })),
		);
		await expect(wrongType.html('/templates/2/preview')).rejects.toThrow(/expected HTML/);
	});

	it('accepts plain text only through the campaign-document reader', async () => {
		const request = vi.fn(async () => new Response('Plain campaign', { headers: { 'content-type': 'text/plain; charset=UTF-8' } }));
		const transport = createListmonkTransport(config, request);

		await expect(transport.document('/campaigns/1/preview')).resolves.toBe('Plain campaign');
		await expect(transport.html('/templates/1/preview')).rejects.toThrow(/expected HTML/);
	});

	it('rejects HTML over 5 MB without retaining it', async () => {
		let cancelled = false;
		const request = vi.fn(async () =>
			new Response(
				new ReadableStream({
					pull(controller) {
						controller.enqueue(new Uint8Array(5_000_001));
					},
					cancel() {
						cancelled = true;
					},
				}),
				{ headers: { 'content-type': 'text/html' } },
			),
		);
		const transport = createListmonkTransport(config, request);

		await expect(transport.html('/templates/2/preview')).rejects.toBeInstanceOf(UpstreamProtocolError);
		expect(cancelled).toBe(true);
	});
});
