import type { LinkField } from "$lib/storyblok/types";

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const STORYBLOK_EDITOR_SIGNATURE_KEYS = [
  '_storyblok_tk[space_id]',
  '_storyblok_tk[timestamp]',
  '_storyblok_tk[token]'
] as const;
const STORYBLOK_RELEASE_KEY = '_storyblok_release';

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
 * Keep an authenticated Storyblok Visual Editor request in draft mode while
 * navigating to another internal page. Editor UI state, campaign parameters,
 * and any Storyblok-looking values supplied by CMS content are not forwarded.
 */
export function withStoryblokEditorParams(
  href: string,
  currentUrl: URL,
  isDraft: boolean
): string {
  if (!isDraft || !href.startsWith('/') || href.startsWith('//')) return href;

  const target = new URL(href, 'https://storyblok-preview.invalid');
  for (const key of [...target.searchParams.keys()]) {
    if (key.startsWith('_storyblok')) target.searchParams.delete(key);
  }

  const [spaceId, timestamp, signature] = STORYBLOK_EDITOR_SIGNATURE_KEYS.map((key) =>
    currentUrl.searchParams.get(key)
  );
  if (
    !spaceId || !/^\d+$/.test(spaceId) ||
    !timestamp || !/^\d+$/.test(timestamp) ||
    !signature || !/^[a-f\d]{40}$/i.test(signature)
  ) {
    return `${target.pathname}${target.search}${target.hash}`;
  }

  for (const [key, value] of STORYBLOK_EDITOR_SIGNATURE_KEYS.map((key, index) =>
    [key, [spaceId, timestamp, signature][index]] as const
  )) {
    target.searchParams.set(key, value);
  }

  const release = currentUrl.searchParams.get(STORYBLOK_RELEASE_KEY);
  if (release && /^\d+$/.test(release) && release !== '0') {
    target.searchParams.set(STORYBLOK_RELEASE_KEY, release);
  }

  return `${target.pathname}${target.search}${target.hash}`;
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
