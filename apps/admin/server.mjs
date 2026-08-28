import { fileURLToPath } from 'node:url';
import { serve } from 'srvx';
import { staticMiddleware } from 'srvx/static';
import { handleRequest } from './dist/server/server.js';

const production = process.env.ADMIN_RUNTIME === 'production';
const staticFiles = staticMiddleware({ dir: fileURLToPath(new URL('./dist/client', import.meta.url)) });

const productionAssets = async (request, next) => {
	const pathname = new URL(request.url).pathname;
	// Never let static index.html bypass the production runtime guard. Only
	// immutable build assets and explicit public assets are served outside it.
	if (!pathname.startsWith('/assets/') && pathname !== '/favicon.ico' && pathname !== '/logo.svg') return next();
	return staticFiles(request, next);
};

// The outer deployment boundary owns files; application documents always pass
// through Solid's runtime guard before the CSR shell is returned.
export const fetch = handleRequest;
export const middleware = production ? [productionAssets] : [];

// Keep the same standards-based server entry usable by the development CLI
// and as the production container executable.
if (import.meta.main) {
	const configuredPort = process.env.PORT;
	const port = configuredPort === undefined ? undefined : Number(configuredPort);
	if (port !== undefined && (!Number.isSafeInteger(port) || port < 1 || port > 65_535)) {
		throw new Error('PORT must be an integer between 1 and 65535.');
	}
	serve({ fetch, middleware, gracefulShutdown: true, port });
}
