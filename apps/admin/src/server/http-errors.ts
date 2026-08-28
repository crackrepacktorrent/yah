export class HttpError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = 'HttpError';
	}
}

type ErrorLogger = (message: string, error: unknown) => void;

function createErrorId(): string {
	return crypto.randomUUID().slice(0, 8);
}

/**
 * Preserve deliberately public errors while keeping infrastructure and database
 * details on the server. The reference makes an unexpected browser error
 * traceable in container logs without disclosing the underlying exception.
 */
export function surfaceError(err: unknown, log: ErrorLogger = console.error): never {
	if (err instanceof HttpError) throw err;

	const errorId = createErrorId();
	log(`[admin:${errorId}] Unexpected server error`, err);
	throw new HttpError(`An unexpected error occurred. Reference: ${errorId}`, 500);
}
