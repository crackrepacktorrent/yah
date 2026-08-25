import { storyblokInit, type SbSvelteComponentsMap } from '@storyblok/svelte';
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

// The SDK's map type assumes components have no required props, while every
// registered Storyblok component correctly requires `blok` at runtime.
const components = {
	page: Page,
	separator: Separator,
	image: Image,
	video: Video,
	pdf: PDF,
	carousel: Carousel,
	text_section: TextSection,
	card_grid: CardGrid,
	card: Card,
	section: Section,
	grid: Grid,
	button: Button,
	footer: Footer
} as unknown as SbSvelteComponentsMap;

/** Register Storyblok components for SSR and hydration without exposing a preview token. */
export function initializeStoryblokComponents(): void {
	if (initialized) return;

	storyblokInit({ bridge: isPreviewMode(), components });

	initialized = true;
}
