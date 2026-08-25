import type { StoryblokRichTextNodeResolver } from '@storyblok/svelte';
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

function cssPropertyName(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function styleFromAttributes(attributes: Record<string, unknown>): string {
  return Object.entries(attributes)
    .filter(([property, value]) =>
      value !== undefined
      && value !== null
      && (/^--[\w-]+$/.test(property) || /^[a-zA-Z][\w-]*$/.test(property))
    )
    .map(([property, value]) => `${cssPropertyName(property)}: ${String(value)}`)
    .join('; ');
}

function nodeText(node: Parameters<StoryblokRichTextNodeResolver>[0]): string {
  return 'text' in node && typeof node.text === 'string' ? node.text : '';
}

export const highlightResolver: StoryblokRichTextNodeResolver = (node, context) => {
  const color = typeof node.attrs?.color === 'string' ? node.attrs.color.trim() : '';

  if (!color) return context.render('mark', {}, nodeText(node));

  return context.render('mark', {
    'data-color': escapeAttribute(color),
    style: escapeAttribute(`background-color: ${color}; color: inherit;`)
  }, nodeText(node));
};

/**
 * Storyblok can order a textStyle mark outside a link mark. The data attribute
 * lets TextSection restore inheritance only when an editor explicitly chose a
 * text color, while uncolored links still use the global link variables.
 */
export const textStyleResolver: StoryblokRichTextNodeResolver = (node, context) => {
  const { class: className, id, style: existingStyle, ...styleAttributes } = node.attrs ?? {};
  const style = [
    typeof existingStyle === 'string' ? existingStyle.trim().replace(/;$/, '') : '',
    styleFromAttributes(styleAttributes)
  ].filter(Boolean).join('; ');
  const hasExplicitTextColor = (typeof styleAttributes.color === 'string'
    && styleAttributes.color.trim() !== '')
    || (typeof existingStyle === 'string' && /(?:^|;)\s*color\s*:/i.test(existingStyle));

  return context.render('span', {
    ...(typeof className === 'string' && className ? { class: escapeAttribute(className) } : {}),
    ...(typeof id === 'string' && id ? { id: escapeAttribute(id) } : {}),
    ...(style ? { style: escapeAttribute(style) } : {}),
    ...(hasExplicitTextColor ? { 'data-rich-text-color': 'true' } : {})
  }, nodeText(node));
};

export function createLinkResolver(lang: string): StoryblokRichTextNodeResolver {
  return (node, context) => {
    const { href, linktype, anchor, target, title } = node.attrs ?? {};
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

    if (!linkUrl) return nodeText(node);

    const openInNewTab = target === '_blank';
    return context.render('a', {
      href: escapeAttribute(linkUrl),
      ...(target === '_self' || openInNewTab ? { target } : {}),
      ...(openInNewTab ? { rel: 'noopener noreferrer' } : {}),
      ...(typeof title === 'string' && title ? { title: escapeAttribute(title) } : {})
    }, nodeText(node));
  };
}
