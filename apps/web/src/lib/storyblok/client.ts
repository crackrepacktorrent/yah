import type { LinkField } from "$lib/storyblok/types";

/**
 * Extracts URL from a Storyblok link field.
 * - Story links: uses cached_url (the slug managed by Storyblok), prefixed with /
 * - External links: uses url (the raw URL entered by the editor)
 */
export function getLinkUrl(link?: LinkField): string {
  if (!link) return '#';
  if (link.linktype === 'story') {
    const slug = link.cached_url || '';
    return slug ? `/${slug.replace(/^\//, '')}` : '#';
  }
  return link.url || link.cached_url || '#';
}

/**
 * Returns true if the link points outside the site (linktype is not "story").
 */
export function isExternalLink(link?: LinkField): boolean {
  return !!link && link.linktype !== 'story';
}
