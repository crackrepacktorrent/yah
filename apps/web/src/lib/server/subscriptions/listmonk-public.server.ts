const UPSTREAM_TIMEOUT_MS = 8_000;
const MAX_JSON_BYTES = 1_000_000;

export const MAX_LIST_UUID_LENGTH = 128;

export type PublicSubscriptionList = { uuid: string; name: string };
export type PublicSubscriptionRequest = {
	email: string;
	name?: string;
	listUuids: string[];
};
export type PublicSubscriptionResult = { hasOptin: boolean };

export interface PublicSubscriptionsGateway {
	listPublicLists(): Promise<PublicSubscriptionList[]>;
	subscribe(request: PublicSubscriptionRequest): Promise<PublicSubscriptionResult>;
}

type PublicRequest = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class ListmonkPublicHttpError extends Error {
	constructor(public readonly status: number) {
		super(`Listmonk public request failed with status ${status}.`);
		this.name = 'ListmonkPublicHttpError';
	}
}

export class ListmonkPublicProtocolError extends Error {
	constructor() {
		super('Listmonk returned an invalid public API response.');
		this.name = 'ListmonkPublicProtocolError';
	}
}

export class ListmonkPublicTransportError extends Error {
	constructor() {
		super('Listmonk public API could not be reached.');
		this.name = 'ListmonkPublicTransportError';
	}
}

async function readBoundedText(response: Response): Promise<string> {
	const declaredLength = Number(response.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
		await response.body?.cancel().catch(() => undefined);
		throw new ListmonkPublicProtocolError();
	}

	const reader = response.body?.getReader();
	if (!reader) return '';
	const chunks: Uint8Array[] = [];
	let length = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (length + value.length > MAX_JSON_BYTES) {
				throw new ListmonkPublicProtocolError();
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

async function requestJson(request: PublicRequest, url: string, init: RequestInit): Promise<unknown> {
	let response: Response;
	try {
		response = await request(url, {
			...init,
			cache: 'no-store',
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
		});
	} catch {
		throw new ListmonkPublicTransportError();
	}

	if (!response.ok) {
		// Consume only a bounded amount so the connection can be reused. The body is
		// deliberately discarded: Listmonk errors can contain subscriber details.
		await readBoundedText(response).catch(() => undefined);
		throw new ListmonkPublicHttpError(response.status);
	}
	if (!(response.headers.get('content-type')?.toLowerCase().includes('json') ?? false)) {
		await response.body?.cancel().catch(() => undefined);
		throw new ListmonkPublicProtocolError();
	}

	let text: string;
	try {
		text = await readBoundedText(response);
	} catch (error) {
		if (error instanceof ListmonkPublicProtocolError) throw error;
		throw new ListmonkPublicTransportError();
	}
	try {
		return JSON.parse(text);
	} catch {
		throw new ListmonkPublicProtocolError();
	}
}

function parsePublicLists(value: unknown): PublicSubscriptionList[] {
	if (!Array.isArray(value)) throw new ListmonkPublicProtocolError();
	const seen = new Set<string>();
	return value.map((candidate) => {
		if (typeof candidate !== 'object' || candidate === null) {
			throw new ListmonkPublicProtocolError();
		}
		const uuid = Reflect.get(candidate, 'uuid');
		const name = Reflect.get(candidate, 'name');
		if (
			typeof uuid !== 'string' ||
			uuid.length === 0 ||
			uuid.length > MAX_LIST_UUID_LENGTH ||
			typeof name !== 'string' ||
			seen.has(uuid)
		) {
			throw new ListmonkPublicProtocolError();
		}
		seen.add(uuid);
		return { uuid, name };
	});
}

function parseSubscriptionResult(value: unknown): PublicSubscriptionResult {
	if (typeof value !== 'object' || value === null) throw new ListmonkPublicProtocolError();
	const data = Reflect.get(value, 'data');
	if (typeof data !== 'object' || data === null || typeof Reflect.get(data, 'has_optin') !== 'boolean') {
		throw new ListmonkPublicProtocolError();
	}
	return { hasOptin: Reflect.get(data, 'has_optin') as boolean };
}

export function createListmonkPublicSubscriptions(
	baseUrl: string,
	request: PublicRequest = fetch
): PublicSubscriptionsGateway {
	const apiBase = `${baseUrl.replace(/\/+$/, '')}/api/public`;
	return {
		async listPublicLists() {
			return parsePublicLists(
				await requestJson(request, `${apiBase}/lists`, {
					headers: { Accept: 'application/json' }
				})
			);
		},
		async subscribe(input) {
			return parseSubscriptionResult(
				await requestJson(request, `${apiBase}/subscription`, {
					method: 'POST',
					headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
					body: JSON.stringify({
						email: input.email,
						name: input.name,
						list_uuids: input.listUuids
					})
				})
			);
		}
	};
}
