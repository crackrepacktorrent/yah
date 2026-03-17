import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { getStoryblokVersion } from "$lib/utils/storyblok-helpers";

export const load: PageLoad = async ({ parent, params, fetch }) => {
  const { storyblokApi, lang } = await parent();
  const slug = params.slug && params.slug !== "" ? params.slug : "home";

  try {
    // Use SvelteKit's fetch directly for better SSR support
    const token = import.meta.env.VITE_STORYBLOK_TOKEN;
    const version = getStoryblokVersion();
    const url = new URL(`https://api.storyblok.com/v2/cdn/stories/${slug}`);
    url.searchParams.set('version', version);
    url.searchParams.set('language', lang);
    url.searchParams.set('fallback_lang', 'en');
    url.searchParams.set('token', token);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw error(response.status === 404 ? 404 : 500, {
        message: `Story not found: ${slug}`
      });
    }

    const data = await response.json();

    if (!data.story) {
      throw error(404, {
        message: `Story not found: ${slug}`
      });
    }

    return {
      story: data.story,
    };
  } catch (err) {
    console.error(`Failed to load story: ${slug}`, err);
    throw error(404, {
      message: `Page not found: ${slug}`
    });
  }
};
