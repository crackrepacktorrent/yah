/** Whether this build should load the client-side Visual Editor bridge. */
export function isPreviewMode(): boolean {
  return import.meta.env.VITE_STORYBLOK_IS_PREVIEW === 'true';
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
