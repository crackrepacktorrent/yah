import { describe, expect, it } from 'vitest';
import { parseJsonResponse, readErrorBody, UpstreamProtocolError } from './http';

describe('upstream response parsing', () => {
	it('parses JSON responses', async () => {
		const response = new Response(JSON.stringify({ ok: true }), {
			headers: { 'content-type': 'application/json' },
		});
		expect(await parseJsonResponse<{ ok: boolean }>(response, 'Test')).toEqual({ ok: true });
	});

	it('rejects successful HTML responses', async () => {
		const response = new Response('<html>proxy error</html>', {
			headers: { 'content-type': 'text/html' },
		});
		await expect(parseJsonResponse(response, 'Test')).rejects.toBeInstanceOf(UpstreamProtocolError);
	});

	it('caps successful JSON when a provider boundary supplies a byte limit', async () => {
		let cancelled = false;
		const response = new Response(
			new ReadableStream({
				pull(controller) {
					controller.enqueue(new Uint8Array(11));
				},
				cancel() {
					cancelled = true;
				},
			}),
			{ headers: { 'content-type': 'application/json' } },
		);

		await expect(parseJsonResponse(response, 'Test', 10)).rejects.toThrow(/exceeded the 10 byte safety limit/);
		expect(cancelled).toBe(true);
	});

	it('caps retained upstream error text and cancels the remainder', async () => {
		let cancelled = false;
		let emitted = 0;
		const response = new Response(
			new ReadableStream({
				pull(controller) {
					if (emitted >= 10) return controller.close();
					emitted += 1;
					controller.enqueue(new TextEncoder().encode('x'.repeat(1_500)));
				},
				cancel() {
					cancelled = true;
				},
			}),
		);

		expect((await readErrorBody(response)).text).toHaveLength(2_000);
		expect(cancelled).toBe(true);
		expect(emitted).toBeLessThan(10);
	});
});
