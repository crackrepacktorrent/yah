import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";

export const load: PageLoad = async ({ parent }) => {
  // Only accessible in preview mode (dev/staging), not production
  const isPreview = import.meta.env.VITE_STORYBLOK_IS_PREVIEW === 'true';
  if (!isPreview) {
    throw error(404, { message: 'Page not found' });
  }

  const { shortlinks } = await parent();

  return {
    shortlinks: shortlinks ?? [],
  };
};
