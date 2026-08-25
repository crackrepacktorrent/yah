import type { Handle } from '@sveltejs/kit';
import { isAuthorizedStoryblokEditorRequest } from '$lib/server/storyblok';
import { isPreviewMode } from '$lib/storyblok/helpers';

const PUBLIC_PAGE_CACHE = 'public, s-maxage=14400, max-age=60, stale-while-revalidate=60';
const PRIVATE_NO_STORE = 'private, no-store';

export const handle: Handle = async ({ event, resolve }) => {
	const lang = event.params.lang === 'es' ? 'es' : 'en';
	const isSignedDraft = isAuthorizedStoryblokEditorRequest(event.url);

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('lang="en"', `lang="${lang}"`)
	});

	const isError = response.status >= 400;
	const isPreviewDeployment = isPreviewMode();
	if (isSignedDraft || isPreviewDeployment || isError) {
		response.headers.set('Cache-Control', PRIVATE_NO_STORE);
	} else if (
		(event.request.method === 'GET' || event.request.method === 'HEAD') &&
		event.route.id === '/[[lang=lang]]/[...slug]' &&
		response.status >= 200 &&
		response.status < 300
	) {
		response.headers.set('Cache-Control', PUBLIC_PAGE_CACHE);
	}

	if (isSignedDraft || isPreviewDeployment) {
		response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
	}

	return response;
};
