import type { StoryblokRichTextProps } from '@storyblok/svelte';
import type { LinkField } from './types';
import { getLinkUrl, getLocalizedLinkUrl } from './client';

function escapeAttribute(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function createLinkRenderer(lang: string) {
  return ({ attrs, children }: StoryblokRichTextProps<'link'>): string => {
    const { href, linktype, anchor, target, title } = (attrs ?? {}) as Record<string, unknown>;
    const rawHref = typeof href === 'string' ? href : '';
    const link: LinkField = linktype === 'story'
      ? { linktype, cached_url: rawHref }
      : { linktype: typeof linktype === 'string' ? linktype : undefined, url: rawHref };
    let linkUrl = linktype === 'story'
      ? getLocalizedLinkUrl(link, lang)
      : getLinkUrl(link);

    if (linkUrl && typeof anchor === 'string' && anchor.replace(/^#/, '')) {
      const encodedAnchor = encodeURIComponent(anchor.replace(/^#/, ''));
      linkUrl = `${linkUrl.replace(/#.*$/, '')}#${encodedAnchor}`;
    }

    if (!linkUrl) return children;

    const openInNewTab = target === '_blank';
    const htmlAttributes = [
      `href="${escapeAttribute(linkUrl)}"`,
      target === '_self' || openInNewTab ? `target="${target}"` : '',
      openInNewTab ? 'rel="noopener noreferrer"' : '',
      typeof title === 'string' && title ? `title="${escapeAttribute(title)}"` : ''
    ].filter(Boolean).join(' ');

    return `<a ${htmlAttributes}>${children}</a>`;
  };
}
