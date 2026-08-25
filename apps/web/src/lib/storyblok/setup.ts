import { apiPlugin, storyblokInit } from '@storyblok/svelte';
import { isPreviewMode } from '$lib/storyblok/helpers';
import Page from '$lib/components/storyblok/Page.svelte';
import Separator from '$lib/components/storyblok/Separator.svelte';
import Image from '$lib/components/storyblok/Image.svelte';
import Video from '$lib/components/storyblok/Video.svelte';
import PDF from '$lib/components/storyblok/PDF.svelte';
import Carousel from '$lib/components/storyblok/Carousel.svelte';
import TextSection from '$lib/components/storyblok/TextSection.svelte';
import CardGrid from '$lib/components/storyblok/CardGrid.svelte';
import Card from '$lib/components/storyblok/Card.svelte';
import Section from '$lib/components/storyblok/Section.svelte';
import Grid from '$lib/components/storyblok/Grid.svelte';
import Button from '$lib/components/storyblok/Button.svelte';
import Footer from '$lib/components/storyblok/Footer.svelte';

let initialized = false;

/** Register Storyblok components for SSR and hydration without exposing a preview token. */
export function initializeStoryblokComponents(): void {
	if (initialized) return;

	storyblokInit({
		// The browser only needs the public token. Draft requests are made exclusively
		// by the server after the Visual Editor signature has been validated.
		accessToken: import.meta.env.VITE_STORYBLOK_PUBLIC_TOKEN,
		use: [apiPlugin],
		bridge: isPreviewMode(),
		components: {
			page: Page as any,
			separator: Separator as any,
			image: Image as any,
			video: Video as any,
			pdf: PDF as any,
			carousel: Carousel as any,
			text_section: TextSection as any,
			card_grid: CardGrid as any,
			card: Card as any,
			section: Section as any,
			grid: Grid as any,
			button: Button as any,
			footer: Footer as any
		},
		apiOptions: {
			https: true,
			cache: { clear: 'auto', type: 'none' },
			region: 'eu'
		}
	});

	initialized = true;
}
