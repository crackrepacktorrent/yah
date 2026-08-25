import type { LayoutServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getLanguage } from '$lib/lang';
import {
	getStoryblokErrorStatus,
	getStoryblokRequestContext,
	getStoryblokRequestOptions
} from '$lib/server/storyblok';
import { renderCustomCssStyle } from '$lib/server/custom-css';
import type { ISbStoryData } from '@storyblok/svelte';
import type {
	HeaderButtonBlok,
	CardBlok,
	CardGridBlok,
	ConfigBlok,
	HeaderBlok,
	StoryblokBlok
} from '$lib/storyblok/types';

const EMPTY_HEADER: HeaderBlok = {
	_uid: 'header',
	component: 'header',
	buttons: []
};

interface NavigationPageBlok extends StoryblokBlok {
	body?: StoryblokBlok[];
}

function stripLangPrefix(slug: string): string {
	const withoutSlash = slug.replace(/^\//, '');
	return withoutSlash.replace(/^(?:en|es)\//, '');
}

function isStoryblokBlock(value: unknown): value is StoryblokBlok {
	return typeof value === 'object' && value !== null &&
		typeof (value as { _uid?: unknown })._uid === 'string' &&
		typeof (value as { component?: unknown }).component === 'string';
}

function findCardGrid(blocks: StoryblokBlok[] | undefined): CardGridBlok | null {
	for (const block of blocks ?? []) {
		if (block.component === 'card_grid') return block as CardGridBlok;
		const nestedBlocks = Array.isArray(block.blocks)
			? block.blocks.filter(isStoryblokBlock)
			: undefined;
		const found = findCardGrid(nestedBlocks);
		if (found) return found;
	}
	return null;
}

export const load: LayoutServerLoad = async ({ params, url }) => {
	// English is the default. Preserve the query because Storyblok editor and
	// campaign parameters are meaningful across this canonical redirect.
	if (params.lang === 'en') {
		const path = url.pathname.replace(/^\/en\/?/, '/');
		redirect(301, `${path}${url.search}`);
	}

	const lang = getLanguage(params.lang);
	const context = getStoryblokRequestContext(url);
	const { api, isDraft } = context;
	const requestOptions = getStoryblokRequestOptions(context, lang);

	let dataConfig: { story?: ISbStoryData<ConfigBlok> };
	try {
		({ data: dataConfig } = await api.get('cdn/stories/config', requestOptions));
	} catch (reason) {
		console.error('Storyblok config request failed', { status: getStoryblokErrorStatus(reason) });
		throw error(502, { message: 'Site configuration is temporarily unavailable.' });
	}

	const config = dataConfig.story?.content;
	if (!config || config.component !== 'config') {
		console.error('Storyblok config story is missing or has the wrong root component');
		throw error(502, { message: 'Site configuration is temporarily unavailable.' });
	}

	const header = config.header?.[0] ?? EMPTY_HEADER;
	const buttons = (header.buttons ?? []) as HeaderButtonBlok[];
	const dropdownPageSlugs = buttons
		.filter(
			(button: HeaderButtonBlok) =>
				button.show_dropdown === true && button.link?.linktype === 'story'
		)
		.map((button: HeaderButtonBlok) => stripLangPrefix(button.link?.cached_url || ''))
		.filter((slug): slug is string => Boolean(slug));
	const uniquePageSlugs: string[] = [...new Set<string>(dropdownPageSlugs)];
	const dropdownCards: Record<string, CardBlok[]> = {};

	if (uniquePageSlugs.length > 0) {
		let stories: ISbStoryData<NavigationPageBlok>[];
		try {
			const { data } = await api.get('cdn/stories', {
				...requestOptions,
				by_slugs: uniquePageSlugs.join(',')
			});
			stories = data.stories ?? [];
		} catch (reason) {
			console.error('Storyblok navigation request failed', {
				status: getStoryblokErrorStatus(reason)
			});
			throw error(502, { message: 'Site navigation is temporarily unavailable.' });
		}

		for (const slug of uniquePageSlugs) {
			const story = stories.find((item) => stripLangPrefix(item.full_slug) === slug);
			const cardGrid = findCardGrid(story?.content?.body);
			dropdownCards[slug] = cardGrid?.cards ?? [];
		}
	}

	let customCSSStyle = '';
	try {
		customCSSStyle = renderCustomCssStyle(config.custom_global_css ?? '');
	} catch (reason) {
		console.error('Storyblok custom CSS was rejected', {
			message: reason instanceof Error ? reason.message : 'Invalid CSS'
		});
	}

	return {
		lang,
		header,
		footer: config.footer ?? [],
		customCSSStyle,
		dropdownCards,
		isDraft
	};
};
