/**
 * Single source of truth for whether the app is running in Storyblok preview mode.
 * Preview mode means: drafts are fetched, the Visual Editor bridge is enabled,
 * and the preview API token is used instead of the public one.
 */
export function isPreviewMode(): boolean {
  return import.meta.env.VITE_STORYBLOK_IS_PREVIEW === 'true';
}

/**
 * Returns the correct Storyblok content version based on environment
 * - Returns 'draft' in preview mode
 * - Returns 'published' in production
 */
export function getStoryblokVersion(): 'draft' | 'published' {
  return isPreviewMode() ? 'draft' : 'published';
}

/**
 * Returns whether the Storyblok Bridge should be enabled
 * Bridge enables real-time editing in the Visual Editor
 */
export function shouldEnableBridge(): boolean {
  return isPreviewMode();
}

/**
 * Extracts pixel dimensions from a Storyblok asset URL.
 * Storyblok URLs look like: https://a.storyblok.com/f/{space}/{W}x{H}/{hash}/file.ext
 * Returns null for non-Storyblok URLs or unparseable formats.
 */
export function getStoryblokImageDimensions(url: string): { width: number; height: number } | null {
  const match = url.match(/storyblok\.com\/f\/\d+\/(\d+)x(\d+)\//);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}
