import 'server-only';

import { getRequestEvent } from '@solidjs/web';

/** Capture the request before any await crosses the request-event scope. */
export function getServerRequest(): Request {
	const request = getRequestEvent()?.request;
	if (!request) throw new Error('A server request is required.');
	return request;
}
