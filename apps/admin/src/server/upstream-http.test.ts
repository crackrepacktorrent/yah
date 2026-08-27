import { describe, expect, test } from 'bun:test';
import { parseJsonResponse, readErrorBody, UpstreamProtocolError } from './upstream-http';

describe('upstream response parsing', () => {
	test('parses JSON responses', async () => {
		const response = new Response(JSON.stringify({ ok: true }), {
			headers: { 'content-type': 'application/json' },
		});

		expect(await parseJsonResponse<{ ok: boolean }>(response, 'Test')).toEqual({ ok: true });
	});

	test('rejects successful HTML responses', async () => {
		const response = new Response('<html>proxy error</html>', {
			headers: { 'content-type': 'text/html' },
		});

		expect(parseJsonResponse(response, 'Test')).rejects.toBeInstanceOf(UpstreamProtocolError);
	});

	test('caps retained upstream error text', async () => {
		let cancelled = false;
		let emitted = 0;
		const response = new Response(
			new ReadableStream({
				pull(controller) {
					if (emitted >= 10) {
						controller.close();
						return;
					}
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
