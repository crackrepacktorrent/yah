import type { LayoutServerLoad } from "./$types";
import { getStoryblokApi } from "@storyblok/svelte";
import { getLanguage } from "$lib/lang";
import { getStoryblokVersion } from "$lib/storyblok/helpers";
import type { HeaderButtonBlok, CardBlok } from "$lib/storyblok/types";
import { redirect } from "@sveltejs/kit";

export const load: LayoutServerLoad = async ({ params, url, setHeaders }) => {
  // English is the default — redirect /en/* to /* to avoid duplicate content
  if (params.lang === 'en') {
    const path = url.pathname.replace(/^\/en\/?/, '/');
    redirect(301, path);
  }
  // 4hr edge cache, 60s browser cache — webhook purges on content publish
  setHeaders({
    'Cache-Control': 'public, s-maxage=14400, max-age=60, stale-while-revalidate=60',
  });

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
      // Batch fetch all dropdown pages in a single API call
      const { data: batchData } = await storyblokApi.get('cdn/stories', {
        version,
        language: lang,
        fallback_lang: 'en',
        by_slugs: uniquePageSlugs.join(','),
      }).catch(() => ({ data: { stories: [] } }));

      const pageResults = uniquePageSlugs.map((slug: string) => {
        const story = batchData.stories?.find((s: any) => stripLangPrefix(s.full_slug) === slug);
        return { slug, data: story ? { story } : null };
      });

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
      lang,
      header,
      footer: config?.footer ?? null,
      customCSS: config?.custom_global_css ?? '',
      dropdownCards,
    };
  } catch (error) {
    console.error('Failed to load layout data:', error);
    return {
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
