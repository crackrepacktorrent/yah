import type { LinkField, AssetField } from "$lib/storyblok/types";

/**
 * Extracts URL from Storyblok link field
 * @param link - Storyblok link field
 * @returns URL string or '#' as fallback
 */
export function getLinkUrl(link?: LinkField): string {
  return link?.cached_url || link?.url || "#";
}

/**
 * Extracts filename from Storyblok asset field
 * @param asset - Storyblok asset field
 * @returns Filename string or empty string as fallback
 */
export function getAssetUrl(asset?: AssetField): string {
  return asset?.filename || "";
}

/**
 * Extracts alt text from Storyblok asset field
 * @param asset - Storyblok asset field
 * @param fallback - Fallback text if alt is not defined
 * @returns Alt text string
 */
export function getAssetAlt(asset?: AssetField, fallback: string = ""): string {
  return asset?.alt || fallback;
}

/**
 * Checks if a URL is external (not an internal route)
 * @param url - URL to check
 * @returns True if URL is external
 */
export function isExternalUrl(url: string): boolean {
  return (
    url.startsWith("http") ||
    url.startsWith("//") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:")
  );
}

/**
 * Formats a date string for display
 * @param dateString - ISO date string
 * @param locale - Locale for formatting (defaults to user's locale)
 * @returns Formatted date string or empty string if invalid
 */
export function formatDate(dateString?: string, locale?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? "" : date.toLocaleDateString(locale);
}
