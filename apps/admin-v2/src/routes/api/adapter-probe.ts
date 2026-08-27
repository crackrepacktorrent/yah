import type { APIHandler } from 'filesystem-routing/api';

export const GET: APIHandler = ({ request }) => {
	const isStreamingProbe = new URL(request.url).searchParams.has('stream');
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const encoder = new TextEncoder();
			controller.enqueue(encoder.encode(`solid${isStreamingProbe ? 'x'.repeat(64 * 1024) : ''}`));
			if (isStreamingProbe) await new Promise((resolve) => setTimeout(resolve, 500));
			controller.enqueue(encoder.encode('-adapter'));
			controller.close();
		},
	});
	const headers = new Headers({
		'cache-control': 'no-transform',
		'content-encoding': 'identity',
		'content-type': 'text/plain; charset=utf-8',
	});
	headers.append('set-cookie', 'adapter-first=1; Path=/; HttpOnly; SameSite=Lax');
	headers.append('set-cookie', 'adapter-second=2; Path=/; HttpOnly; SameSite=Lax');

	return new Response(stream, { headers });
};

export const POST: APIHandler = async ({ request }) => {
	const body: unknown = await request.json();
	return Response.json({ body, method: request.method });
};
