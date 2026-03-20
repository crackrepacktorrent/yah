import type { LayoutLoad } from "./$types";
import { storyblokInit, apiPlugin, getStoryblokApi } from "@storyblok/svelte";
import { getLanguage } from "$lib/lang";
import { getStoryblokVersion, shouldEnableBridge } from "$lib/storyblok/helpers";
import type { HeaderButtonBlok, CardBlok } from "$lib/storyblok/types";
import Page from "$lib/components/storyblok/Page.svelte";
import Separator from "$lib/components/storyblok/Separator.svelte";
import Image from "$lib/components/storyblok/Image.svelte";
import Video from "$lib/components/storyblok/Video.svelte";
import PDF from "$lib/components/storyblok/PDF.svelte";
import Carousel from "$lib/components/storyblok/Carousel.svelte";
import TextSection from "$lib/components/storyblok/TextSection.svelte";
import CardGrid from "$lib/components/storyblok/CardGrid.svelte";
import Card from "$lib/components/storyblok/Card.svelte";
import Section from "$lib/components/storyblok/Section.svelte";
import Grid from "$lib/components/storyblok/Grid.svelte";
import Button from "$lib/components/storyblok/Button.svelte";
import Footer from "$lib/components/storyblok/Footer.svelte";


storyblokInit({
  accessToken: import.meta.env.VITE_STORYBLOK_TOKEN,
  use: [apiPlugin],
  bridge: shouldEnableBridge(),
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
    footer: Footer as any,
  },
  apiOptions: {
    https: true,
    cache: {
      clear: "auto",
      type: shouldEnableBridge() ? "none" : "memory",
    },
    region: "eu",
  },
});

export const load: LayoutLoad = async ({ params }) => {
  const lang = getLanguage(params.lang);
  const storyblokApi = getStoryblokApi();

  try {
    const version = getStoryblokVersion();

    const fetchStory = (slug: string) =>
      storyblokApi.get(`cdn/stories/${slug}`, {
        version,
        language: lang,
        fallback_lang: 'en',
      });

    const { data: dataConfig } = await fetchStory('config');
    const config = dataConfig.story?.content;
    const header = config?.header?.[0] ?? {
      _uid: 'header',
      component: 'header',
      buttons: []
    };
    const buttons = header.buttons ?? [];
    // Helper to strip language prefix from slugs (for field-level translation)
    const stripLangPrefix = (slug: string) => {
      const withoutSlash = slug.startsWith("/") ? slug.slice(1) : slug;
      if (withoutSlash.startsWith("en/") || withoutSlash.startsWith("es/")) {
        return withoutSlash.slice(3);
      }
      return withoutSlash;
    };

    // Find which pages are referenced by buttons for dropdowns
    // Strip language prefixes - field-level translation uses single story with language parameter
    const dropdownPageSlugs = buttons
      .filter((btn: HeaderButtonBlok) => btn.show_dropdown && btn.link?.linktype === 'story')
      .map((btn: HeaderButtonBlok) => stripLangPrefix(btn.link?.cached_url || ''))
      .filter((slug: string) => slug);

    const uniquePageSlugs = [...new Set(dropdownPageSlugs)] as string[];

    // Fetch only the pages that are actually referenced
    const dropdownCards: Record<string, CardBlok[]> = {};

    if (uniquePageSlugs.length > 0) {
      const pageResults = await Promise.all(
        uniquePageSlugs.map((slug: string) =>
          fetchStory(slug).then(({ data }) => ({ slug, data })).catch(() => ({ slug, data: null }))
        )
      );

      // Helper function to find card_grid recursively
      function findCardGrid(blocks: any[]): any {
        if (!blocks) return null;
        for (const block of blocks) {
          if (block.component === 'card_grid') return block;
          if (block.blocks && Array.isArray(block.blocks)) {
            const found = findCardGrid(block.blocks);
            if (found) return found;
          }
        }
        return null;
      }

      for (const { slug, data } of pageResults) {
        if (data) {
          const cardGrid = findCardGrid(data.story?.content?.body || []);
          dropdownCards[slug] = cardGrid?.cards ?? [];
        } else {
          dropdownCards[slug] = [];
        }
      }
    }

    return {
      storyblokApi,
      lang,
      header,
      footer: config?.footer ?? null,
      customCSS: config?.custom_global_css ?? '',
      dropdownCards,
    };
  } catch (error) {
    console.error('Failed to load layout data:', error);
    return {
      storyblokApi,
      lang,
      header: {
        _uid: 'header',
        component: 'header',
        buttons: []
      },
      footer: null,
      customCSS: '',
      dropdownCards: {},
    };
  }
};
