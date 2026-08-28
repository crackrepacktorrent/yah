import 'server-only';
import { surfaceError } from './errors';
import { getServerRequest } from './request';
import { requireProductionRuntime } from './runtime.server';

type ProductionRequestOperation<TResult> = (request: Request) => Promise<TResult>;

/**
 * Run one explicit server-function operation behind the production runtime and
 * public-error boundary. Request capture stays synchronous so the Solid request
 * event cannot be lost across the operation's first await.
 */
export async function runProductionRequest<TResult>(operation: ProductionRequestOperation<TResult>): Promise<TResult> {
	const request = getServerRequest();

	try {
		requireProductionRuntime();
		return await operation(request);
	} catch (error) {
		surfaceError(error);
	}
}
