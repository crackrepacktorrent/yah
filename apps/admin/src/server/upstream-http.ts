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
	return fetch(input, {
		...init,
		signal: requestSignal(init.signal, timeoutMs),
	});
}

export async function parseJsonResponse<T>(response: Response, service: string): Promise<T> {
	if (response.status === 204) return undefined as T;

	const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
	if (!contentType.includes('json')) {
		throw new UpstreamProtocolError(service, `expected JSON but received ${contentType || 'an unknown content type'}`);
	}

	try {
		return (await response.json()) as T;
	} catch {
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
		// Preserve any prefix already read; upstream error bodies are diagnostic.
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
