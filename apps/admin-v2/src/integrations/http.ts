const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ERROR_BODY_LENGTH = 2_000;

export class UpstreamProtocolError extends Error {
	constructor(service: string, message: string) {
		super(`${service} protocol error: ${message}`);
		this.name = 'UpstreamProtocolError';
	}
}

function requestSignal(signal: AbortSignal | null | undefined, timeoutMs: number): AbortSignal {
	const timeout = AbortSignal.timeout(timeoutMs);
	return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export function fetchUpstream(input: string | URL, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
	return fetch(input, { ...init, signal: requestSignal(init.signal, timeoutMs) });
}

async function readBoundedResponseText(response: Response, service: string, maxBytes: number): Promise<string> {
	const declaredLength = Number(response.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
		await response.body?.cancel().catch(() => undefined);
		throw new UpstreamProtocolError(service, `JSON response exceeded the ${maxBytes} byte safety limit`);
	}

	const reader = response.body?.getReader();
	if (!reader) return '';
	const chunks: Uint8Array[] = [];
	let length = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (length + value.length > maxBytes) {
				throw new UpstreamProtocolError(service, `JSON response exceeded the ${maxBytes} byte safety limit`);
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

export async function parseJsonResponse<T>(response: Response, service: string, maxBytes?: number): Promise<T> {
	if (response.status === 204) return undefined as T;
	const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
	if (!contentType.includes('json')) {
		throw new UpstreamProtocolError(service, `expected JSON but received ${contentType || 'an unknown content type'}`);
	}
	try {
		return (maxBytes === undefined ? await response.json() : JSON.parse(await readBoundedResponseText(response, service, maxBytes))) as T;
	} catch (error) {
		if (error instanceof UpstreamProtocolError) throw error;
		throw new UpstreamProtocolError(service, 'received malformed JSON');
	}
}

export async function readErrorBody(response: Response): Promise<{ json: unknown; text: string }> {
	const reader = response.body?.getReader();
	if (!reader) return { json: null, text: '' };
	const bytes = new Uint8Array(MAX_ERROR_BODY_LENGTH);
	let length = 0;
	try {
		while (length < MAX_ERROR_BODY_LENGTH) {
			const { done, value } = await reader.read();
			if (done) break;
			const remaining = MAX_ERROR_BODY_LENGTH - length;
			const chunk = value.subarray(0, remaining);
			bytes.set(chunk, length);
			length += chunk.length;
			if (chunk.length < value.length) break;
		}
	} catch {
		// Preserve the diagnostic prefix already read.
	} finally {
		await reader.cancel().catch(() => undefined);
	}
	const text = new TextDecoder().decode(bytes.subarray(0, length));
	try {
		return { json: JSON.parse(text), text };
	} catch {
		return { json: null, text };
	}
}
