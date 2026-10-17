import { describe, expect, it, mock } from 'bun:test';
import { collectAnalytics } from './collector.server';

const endpoint = 'http://umami:3000/api/t';
const body = '{ "type": "event", "payload": {"website":"fixture", "url":"/es", "title":"Hogar 🏠"} }';
const sourceHeaders = {
	'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.10',
	'user-agent': 'fixture-browser', 'x-umami-cache': 'existing-session-token',
	'origin': 'https://preview.y4h.org', 'cf-ipcountry': 'US', 'cf-region-code': 'NY',
	'cf-ipcity': 'New York City', 'cf-postal-code': '11217',
	'cf-iplatitude': '40.6848', 'cf-iplongitude': '-73.9772',
	'cookie': 'private=session', 'authorization': 'Bearer private'
};
const event = () => new Request('https://y4h.org/api/t', { method: 'POST', body, headers: sourceHeaders });

describe('analytics collector', () => {
	it('forwards one unchanged event with visitor identity and cache intact, enriching only the city', async () => {
		const upstream = mock(async (url: string, init: RequestInit) => {
			expect(url).toBe(endpoint);
			expect(init.method).toBe('POST');
			expect(new Uint8Array(init.body as ArrayBuffer)).toEqual(new TextEncoder().encode(body));
			const headers = new Headers(init.headers);
			for (const name of ['cf-connecting-ip', 'user-agent', 'x-umami-cache', 'origin', 'cf-ipcountry', 'cf-region-code'] as const) {
				expect(headers.get(name)).toBe(sourceHeaders[name]);
			}
			expect(headers.get('cf-ipcity')).toBe('Brooklyn (estimated)');
			for (const name of ['cf-postal-code', 'cf-iplatitude', 'cf-iplongitude', 'cookie', 'authorization']) expect(headers.has(name)).toBe(false);
			return new Response('{"cache":"next-session-token","sessionId":"same-visitor"}', {
				headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
			});
		});
		const request = event();
		const result = await collectAnalytics(request, endpoint, upstream);
		expect(upstream).toHaveBeenCalledTimes(1);
		expect(request.headers.get('cf-ipcity')).toBe('New York City');
		expect(result.status).toBe(200);
		expect(result.headers.get('access-control-allow-origin')).toBe('*');
		expect(result.headers.get('cache-control')).toBe('no-store');
		expect(await result.text()).toBe('{"cache":"next-session-token","sessionId":"same-visitor"}');
	});

	it('retains the original city when the evidence disagrees', async () => {
		const request = event();
		request.headers.set('cf-postal-code', '10001');
		const upstream = mock(async (_url: string, init: RequestInit) => {
			expect(new Headers(init.headers).get('cf-ipcity')).toBe('New York City');
			return Response.json({ cache: 'same' });
		});
		expect((await collectAnalytics(request, endpoint, upstream)).status).toBe(200);
	});

	it('preserves preflight responses for the preview site', async () => {
		const upstream = mock(async (_url: string, init: RequestInit) => {
			expect(init.method).toBe('OPTIONS');
			expect(init.body).toBeUndefined();
			expect(new Headers(init.headers).get('access-control-request-headers')).toBe('content-type,x-umami-cache');
			return new Response(null, { status: 204, headers: {
				'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST',
				'access-control-allow-headers': 'content-type,x-umami-cache'
			} });
		});
		const result = await collectAnalytics(new Request('https://y4h.org/api/t', { method: 'OPTIONS', headers: {
			origin: 'https://preview.y4h.org', 'access-control-request-method': 'POST',
			'access-control-request-headers': 'content-type,x-umami-cache'
		} }), endpoint, upstream);
		expect(result.status).toBe(204);
		expect(result.headers.get('access-control-allow-headers')).toBe('content-type,x-umami-cache');
	});

	it('does not retry rejected or ambiguously completed events', async () => {
		const rejected = mock(async () => new Response('rejected', { status: 400 }));
		const response = await collectAnalytics(event(), endpoint, rejected);
		expect(response.status).toBe(400);
		expect(await response.text()).toBe('rejected');
		expect(rejected).toHaveBeenCalledTimes(1);
		const failed = mock(async () => { throw new Error('timeout with private request details'); });
		const error = await collectAnalytics(event(), endpoint, failed);
		expect(error.status).toBe(502);
		expect(await error.text()).toBe('');
		expect(failed).toHaveBeenCalledTimes(1);
	});

	it('requires an explicit internal collector URL', async () => {
		const upstream = mock(async () => Response.json({}));
		expect((await collectAnalytics(event(), undefined, upstream)).status).toBe(503);
		expect(upstream).not.toHaveBeenCalled();
	});
});
