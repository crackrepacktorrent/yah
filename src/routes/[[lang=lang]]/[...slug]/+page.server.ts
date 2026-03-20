import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { getStoryblokApi } from "@storyblok/svelte";
import { getStoryblokVersion } from "$lib/storyblok/helpers";

export const load: PageServerLoad = async ({ parent, params }) => {
  const { lang } = await parent();
  const storyblokApi = getStoryblokApi();
  const slug = params.slug && params.slug !== "" ? params.slug : "home";

  // Admin routes are handled by their own layouts, not Storyblok
  if (slug === 'admin' || slug.startsWith('admin/')) {
    throw error(404, { message: 'Not a Storyblok page' });
  }

  try {
    const { data } = await storyblokApi.get(`cdn/stories/${slug}`, {
      version: getStoryblokVersion(),
      language: lang,
      fallback_lang: 'en',
    });

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
