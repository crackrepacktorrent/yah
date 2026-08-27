import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getLanguage } from '$lib/lang';
import {
	getStoryblokErrorStatus,
	getStoryblokRequestContext,
	getStoryblokRequestOptions
} from '$lib/server/storyblok';
import type { ISbStoryData } from '@storyblok/svelte';
import type { PageBlok } from '$lib/storyblok/types';

export const load: PageServerLoad = async ({ params, url }) => {
	const requestedSlug = params.slug?.replace(/^\/+|\/+$/g, '') || '';

	// The root route is the only canonical URL for the home story.
	if (requestedSlug === 'home') {
		const homePath = params.lang === 'es' ? '/es' : '/';
		redirect(301, `${homePath}${url.search}`);
	}

	const slug = requestedSlug || 'home';
	if (
		slug === 'config' || slug === 'admin' || slug.startsWith('admin/') ||
		slug.includes('.') || slug.startsWith('_') || slug.startsWith('api/')
	) {
		throw error(404, { message: 'Not found' });
	}

	// Do not await parent(): this lets the page and layout Storyblok calls run in
	// parallel while deriving the same language directly from the route.
	const lang = getLanguage(params.lang);
	const context = await getStoryblokRequestContext(url);
	const { api, isDraft } = context;

	let data: { story?: ISbStoryData<PageBlok> };
	try {
		({ data } = await api.get(
			`cdn/stories/${slug}`,
			getStoryblokRequestOptions(context, lang)
		));
	} catch (reason) {
		const status = getStoryblokErrorStatus(reason);
		if (status === 404) throw error(404, { message: `Page not found: ${slug}` });
		console.error('Storyblok page request failed', { slug, status });
		throw error(502, { message: 'This page is temporarily unavailable.' });
	}

	const story = data.story;
	if (!story || story.content?.component !== 'page') {
		throw error(404, { message: `Page not found: ${slug}` });
	}

	return { story, isDraft, lang };
};
