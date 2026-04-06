import type { RequestHandler } from '@sveltejs/kit';
import { getStoryblokApi } from '@storyblok/svelte';
import { getStoryblokVersion } from '$lib/storyblok/helpers';

const SITE_URL = 'https://y4h.org';

export const GET: RequestHandler = async () => {
	const storyblokApi = getStoryblokApi();

	const { data } = await storyblokApi.get('cdn/links', {
		version: getStoryblokVersion(),
	});

	const links = Object.values(data.links ?? {}) as Array<{
		slug: string;
		is_folder: boolean;
		published: boolean;
	}>;

	const pages = links
		.filter((link) => !link.is_folder && link.published)
		.map((link) => {
			const path = link.slug === 'home' ? '' : link.slug;
			return `${SITE_URL}/${path}`;
		});

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((url) => `	<url>
		<loc>${url}</loc>
	</url>`).join('\n')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=14400',
		},
	});
};
