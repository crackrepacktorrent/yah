/**
 * Returns the correct Storyblok content version based on environment
 * - Returns 'draft' in development or when STORYBLOK_IS_PREVIEW is true
 * - Returns 'published' in production
 */
export function getStoryblokVersion(): 'draft' | 'published' {
  // Check if we're in preview mode via environment variable
  const isPreview = import.meta.env.VITE_STORYBLOK_IS_PREVIEW === 'true';

  return isPreview ? 'draft' : 'published';
}

/**
 * Returns whether the Storyblok Bridge should be enabled
 * Bridge enables real-time editing in the Visual Editor
 */
export function shouldEnableBridge(): boolean {
  return import.meta.env.VITE_STORYBLOK_IS_PREVIEW === 'true';
}
