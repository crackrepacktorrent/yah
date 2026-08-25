import { describe, expect, test } from 'bun:test';
import { renderRichText } from '@storyblok/svelte';
import { createLinkResolver, highlightResolver, textStyleResolver } from './rich-text';

function renderText(marks: Array<{ type: string; attrs?: Record<string, unknown> }>) {
  return renderRichText({
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: 'Press', marks }]
    }]
  } as never, {
    resolvers: {
      highlight: highlightResolver,
      link: createLinkResolver('es'),
      textStyle: textStyleResolver
    }
  });
}

describe('Storyblok rich-text resolvers', () => {
  test('preserves paragraph alignment from the rich-text editor', () => {
    const html = renderRichText({
      type: 'doc',
      content: [{
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [{ type: 'text', text: 'Centered' }]
      }]
    } as never);

    expect(html).toContain('<p style="text-align: center;">Centered</p>');
  });

  test('renders the editor highlight color instead of the browser default', () => {
    const html = renderText([{ type: 'highlight', attrs: { color: '#6B7700' } }]);

    expect(html).toContain('<mark');
    expect(html).toContain('background-color: #6B7700');
  });

  test('localizes story links and keeps the global link color as their default', () => {
    const html = renderText([{ type: 'link', attrs: { linktype: 'story', href: 'press' } }]);

    expect(html).toContain('<a href="/es/press">Press</a>');
    expect(html).not.toContain('data-rich-text-color');
  });

  test('marks linked text that has an explicit editor text color', () => {
    const outerStyleHtml = renderText([
      { type: 'link', attrs: { linktype: 'story', href: 'press' } },
      { type: 'textStyle', attrs: { color: '#FFFDFD' } }
    ]);
    const innerStyleHtml = renderText([
      { type: 'textStyle', attrs: { color: '#FFFDFD' } },
      { type: 'link', attrs: { linktype: 'story', href: 'press' } }
    ]);

    expect(outerStyleHtml).toContain('data-rich-text-color="true"');
    expect(outerStyleHtml).toContain('style="color: #FFFDFD"');
    expect(outerStyleHtml).toContain('<a href="/es/press">Press</a>');
    expect(innerStyleHtml).toContain('<a href="/es/press"><span');
    expect(innerStyleHtml).toContain('data-rich-text-color="true"');
  });

  test('escapes link attributes emitted through the SDK HTML renderer', () => {
    const html = renderText([{
      type: 'link',
      attrs: { linktype: 'url', href: 'https://example.com/?q=&quot;', title: '" onmouseover="alert(1)' }
    }]);

    expect(html).toContain('title="&quot; onmouseover=&quot;alert(1)"');
    expect(html).not.toContain(' title="" onmouseover=');
  });
});
