import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { getStoryblokApi } from "@storyblok/svelte";
import { getStoryblokVersion } from "$lib/storyblok/helpers";

export const load: PageServerLoad = async ({ parent, params }) => {
  const { lang } = await parent();
  const storyblokApi = getStoryblokApi();
  const slug = params.slug && params.slug !== "" ? params.slug : "home";

  // Reject paths that are obviously not Storyblok content pages
  // Prevents vulnerability scanners from wasting API calls
  if (
    slug === 'admin' || slug.startsWith('admin/') ||
    slug.includes('.') ||
    slug.startsWith('_') ||
    slug.startsWith('api/')
  ) {
    throw error(404, { message: 'Not found' });
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
