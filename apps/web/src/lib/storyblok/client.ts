import type { LinkField } from "$lib/storyblok/types";

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Returns a URL that is safe to use in a public href/src attribute.
 * Relative URLs are allowed, while executable and local-file schemes are not.
 */
export function getSafeUrl(url?: string): string {
  const value = url?.trim();
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return '';

  const protocol = value.match(/^([a-z][a-z\d+.-]*):/i)?.[1];
  if (protocol && !SAFE_PROTOCOLS.has(`${protocol.toLowerCase()}:`)) return '';

  return value;
}

/** Restricts media/document URLs to HTTP(S) or a site-relative path. */
export function getSafeHttpUrl(url?: string): string {
  const value = getSafeUrl(url);
  if (!value) return '';

  const protocol = value.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
  return !protocol || protocol === 'http' || protocol === 'https' ? value : '';
}

/**
 * Extracts URL from a Storyblok link field.
 * - Story links: uses cached_url (the slug managed by Storyblok), prefixed with /
 * - External links: uses url (the raw URL entered by the editor)
 */
export function getLinkUrl(link?: LinkField): string {
  if (!link) return '';
  if (link.linktype === 'story') {
    const slug = (link.cached_url || link.story?.full_slug || link.story?.slug || '').trim();
    if (!slug) return '';

    const hashIndex = slug.indexOf('#');
    const hash = hashIndex >= 0 ? slug.slice(hashIndex + 1) : '';
    const pathAndQuery = hashIndex >= 0 ? slug.slice(0, hashIndex) : slug;
    const queryIndex = pathAndQuery.indexOf('?');
    const query = queryIndex >= 0 ? pathAndQuery.slice(queryIndex) : '';
    const rawPath = queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery;
    const normalizedPath = rawPath.replace(/^\/+|\/+$/g, '');
    const path = normalizedPath === 'home' ? '/' : `/${normalizedPath}`;
    return `${path}${query}${hash ? `#${hash}` : ''}`;
  }

  const rawUrl = link.url || link.cached_url || '';
  if (link.linktype === 'email' && rawUrl) {
    const email = rawUrl.replace(/^mailto:/i, '');
    return getSafeUrl(`mailto:${email}`);
  }

  return getSafeUrl(rawUrl);
}

/** Normalizes Storyblok story paths for stable lookups and comparisons. */
export function normalizeStorySlug(slug?: string): string {
  if (!slug) return '';

  const path = slug.trim().split(/[?#]/, 1)[0];
  return path
    .replace(/^\/+|\/+$/g, '')
    .replace(/^(?:en|es)(?:\/|$)/, '')
    .replace(/^\/+|\/+$/g, '');
}

/**
 * Returns true if the link points outside the site (linktype is not "story").
 */
export function isExternalLink(link?: LinkField): boolean {
  return !!link && link.linktype !== 'story';
}

/**
 * Localizes a Storyblok story link while leaving external links untouched.
 * English is served without a locale prefix; other languages use /{lang}/.
 */
export function getLocalizedLinkUrl(link: LinkField | undefined, lang: string): string {
  const url = getLinkUrl(link);
  if (!url || isExternalLink(link)) return url;

  const hashIndex = url.indexOf('#');
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const pathAndQuery = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = pathAndQuery.indexOf('?');
  const query = queryIndex >= 0 ? pathAndQuery.slice(queryIndex) : '';
  let path = queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery;

  path = `/${path.replace(/^\/+/, '').replace(/^(?:en|es)(?:\/|$)/, '')}`;
  if (path === '/home') path = '/';

  const localizedPath = lang === 'en'
    ? path
    : path === '/' ? `/${lang}` : `/${lang}${path}`;

  return `${localizedPath}${query}${hash}`;
}
