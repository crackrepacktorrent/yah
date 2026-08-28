import { isSafeError, markSafeError } from '@solidjs/web';

const publicErrorWireKind = 'yah-public-error-v1';

export class PublicError extends Error {
	/** Enumerable so Solid's server-function codec preserves the app-owned brand. */
	readonly publicErrorKind = publicErrorWireKind;

	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = 'PublicError';
	}
}

type ErrorLogger = (message: string, error: unknown) => void;

export function createPublicError(message: string, status: number): PublicError {
	return markSafeError(new PublicError(message, status));
}

export function isPublicError(error: unknown): error is Error & { publicErrorKind: string; status: number } {
	if (!(error instanceof Error)) return false;
	const status = Reflect.get(error, 'status');
	return (
		Reflect.get(error, 'publicErrorKind') === publicErrorWireKind &&
		typeof status === 'number' &&
		Number.isInteger(status) &&
		status >= 400 &&
		status <= 599
	);
}

/** Log infrastructure details and return only a traceable, branded error. */
export function surfaceError(error: unknown, log: ErrorLogger = console.error): never {
	if (isSafeError(error)) throw error;

	const errorId = crypto.randomUUID().slice(0, 8);
	log(`[admin-v2:${errorId}] Unexpected server error`, error);
	throw createPublicError(`An unexpected error occurred. Reference: ${errorId}`, 500);
}
