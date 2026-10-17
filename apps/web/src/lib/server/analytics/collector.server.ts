import { estimatedBorough } from './borough.server';

const forwardedHeaders = [
	'accept', 'content-type', 'content-encoding', 'user-agent', 'origin', 'referer',
	'x-umami-cache', 'cf-connecting-ip', 'x-forwarded-for', 'x-real-ip',
	'cf-ipcountry', 'cf-region-code', 'cf-ipcity',
	'access-control-request-method', 'access-control-request-headers'
];
type UpstreamRequest = (input: string, init: RequestInit) => Promise<Response>;

export async function collectAnalytics(
	request: Request,
	endpoint: string | undefined,
	upstream: UpstreamRequest = fetch
): Promise<Response> {
	if (!endpoint) return new Response(null, { status: 503, headers: { 'cache-control': 'no-store' } });
	const headers = new Headers();
	for (const name of forwardedHeaders) {
		const value = request.headers.get(name);
		if (value !== null) headers.set(name, value);
	}
	const borough = estimatedBorough(request.headers);
	if (borough) headers.set('cf-ipcity', borough);
	// ZIP and coordinates are used only in memory; Umami receives the label.
	headers.set('accept-encoding', 'identity');
	const body = request.method === 'POST' ? await request.arrayBuffer() : undefined;
	try {
		// Forward once, byte for byte. Retrying a timed-out POST can double-count.
		const response = await upstream(endpoint, {
			method: request.method, headers, body, redirect: 'manual',
			signal: AbortSignal.timeout(8_000)
		});
		const responseHeaders = new Headers(response.headers);
		for (const name of ['connection', 'transfer-encoding', 'content-encoding', 'content-length']) responseHeaders.delete(name);
		responseHeaders.set('cache-control', 'no-store');
		return new Response(response.body, { status: response.status, headers: responseHeaders });
	} catch {
		return new Response(null, { status: 502, headers: { 'cache-control': 'no-store' } });
	}
}
