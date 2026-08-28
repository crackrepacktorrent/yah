import 'server-only';
import type { ProductionConfig } from '~/platform/config/production';
import { fetchUpstream, parseJsonResponse, readErrorBody, UpstreamProtocolError } from '~/integrations/http';

const MAX_HTML_BYTES = 5_000_000;
// Go's JSON encoder can expand each raw `<`, `>`, `&`, or control byte to a
// six-byte `\uXXXX` escape. Keep the response bound above the worst-case
// encoding of an accepted 5 MB authored body plus its template envelope.
const MAX_JSON_BYTES = 32_000_000;

type ListmonkConfig = Pick<ProductionConfig, 'LISTMONK_URL' | 'LISTMONK_API_TOKEN'>;
export type ListmonkRequest = typeof fetchUpstream;

/** Contains no upstream response text or credentials. */
export class ListmonkHttpFailure extends Error {
	constructor(public readonly status: number) {
		super(`Listmonk request failed with status ${status}.`);
		this.name = 'ListmonkHttpFailure';
	}
}

async function readBoundedDocument(response: Response, allowPlainText = false): Promise<string> {
	const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
	if (!contentType.includes('text/html') && !(allowPlainText && contentType.includes('text/plain'))) {
		throw new UpstreamProtocolError(
			'Listmonk',
			`expected ${allowPlainText ? 'HTML or plain text' : 'HTML'} but received ${contentType || 'an unknown content type'}`,
		);
	}

	const declaredLength = Number(response.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > MAX_HTML_BYTES) {
		await response.body?.cancel().catch(() => undefined);
		throw new UpstreamProtocolError('Listmonk', 'HTML response exceeded the 5 MB safety limit');
	}

	const reader = response.body?.getReader();
	if (!reader) return '';
	const chunks: Uint8Array[] = [];
	let length = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (length + value.length > MAX_HTML_BYTES) {
				throw new UpstreamProtocolError('Listmonk', 'HTML response exceeded the 5 MB safety limit');
			}
			chunks.push(value);
			length += value.length;
		}
	} catch (error) {
		await reader.cancel().catch(() => undefined);
		throw error;
	}

	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return new TextDecoder().decode(bytes);
}

export function createListmonkTransport(config: ListmonkConfig, request: ListmonkRequest = fetchUpstream) {
	const baseUrl = `${config.LISTMONK_URL.replace(/\/+$/, '')}/api`;

	async function call(path: string, accept: string, init: RequestInit): Promise<Response> {
		if (!path.startsWith('/')) throw new Error('Listmonk request paths must start with a slash.');
		const headers = new Headers(init.headers);
		headers.set('Accept', accept);
		headers.set('Authorization', `token ${config.LISTMONK_API_TOKEN}`);
		if (init.body !== undefined && init.body !== null && !headers.has('Content-Type')) {
			headers.set('Content-Type', 'application/json');
		}

		const response = await request(`${baseUrl}${path}`, { ...init, headers });
		if (!response.ok) {
			// Drain only a bounded prefix so a proxy error cannot force an unbounded read.
			await readErrorBody(response);
			throw new ListmonkHttpFailure(response.status);
		}
		return response;
	}

	return {
		async json(path: string, init: RequestInit = {}): Promise<unknown> {
			return parseJsonResponse(await call(path, 'application/json', init), 'Listmonk', MAX_JSON_BYTES);
		},
		async html(path: string, init: RequestInit = {}): Promise<string> {
			return readBoundedDocument(await call(path, 'text/html', init));
		},
		async document(path: string, init: RequestInit = {}): Promise<string> {
			return readBoundedDocument(await call(path, 'text/html, text/plain;q=0.9', init), true);
		},
	};
}

export type ListmonkTransport = ReturnType<typeof createListmonkTransport>;
