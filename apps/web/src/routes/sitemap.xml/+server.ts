import { error, type RequestHandler } from '@sveltejs/kit';
import { SITE_URL } from '$lib/config';
import { getPublishedStoryblokApi } from '$lib/server/storyblok';

type SitemapStory = {
	full_slug?: string;
	content?: { component?: string };
	translated_slugs?: Array<{ lang?: string; path?: string }>;
};

function xml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

function publicPath(slug = ''): string | null {
	let path = slug.trim().replace(/^\/+|\/+$/g, '').replace(/^(?:en|es)(?:\/|$)/, '');
	if (path === 'home') path = '';
	if (
		path === 'config' ||
		path === 'admin' ||
		path.startsWith('admin/') ||
		path.startsWith('api/') ||
		path.startsWith('_') ||
		path.includes('.')
	) return null;
	return path ? `/${path}` : '/';
}

function absolute(path: string, lang: 'en' | 'es'): string {
	const localized = lang === 'en' ? path : path === '/' ? '/es' : `/es${path}`;
	return `${SITE_URL}${localized}`;
}

export const GET: RequestHandler = async () => {
	let stories: SitemapStory[];
	try {
		stories = await getPublishedStoryblokApi().getAll('cdn/stories', {
			version: 'published',
			content_type: 'page',
			excluding_fields: 'body',
			per_page: 100
		});
	} catch (reason) {
		console.error('Storyblok sitemap request failed', reason);
		throw error(502, { message: 'Sitemap is temporarily unavailable.' });
	}

	const entries = stories
		.filter((story) => story.content?.component === 'page')
		.map((story) => {
			const englishPath = publicPath(story.full_slug);
			if (!englishPath) return null;

			const translated = story.translated_slugs?.find((slug) => slug.lang === 'es')?.path;
			const spanishPath = translated ? (publicPath(translated) ?? englishPath) : englishPath;
			return {
				en: absolute(englishPath, 'en'),
				es: absolute(spanishPath, 'es')
			};
		})
		.filter((entry): entry is { en: string; es: string } => entry !== null);

	const seen = new Set<string>();
	const urls = entries.flatMap((entry) => [entry.en, entry.es].map((location) => {
		if (seen.has(location)) return '';
		seen.add(location);
		return `\t<url>
		<loc>${xml(location)}</loc>
		<xhtml:link rel="alternate" hreflang="en" href="${xml(entry.en)}" />
		<xhtml:link rel="alternate" hreflang="es" href="${xml(entry.es)}" />
		<xhtml:link rel="alternate" hreflang="x-default" href="${xml(entry.en)}" />
	</url>`;
	})).filter(Boolean);

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, s-maxage=14400, max-age=300'
		}
	});
};
