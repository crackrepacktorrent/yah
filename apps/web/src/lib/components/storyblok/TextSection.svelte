<script lang="ts">
  import { storyblokEditable, renderRichText } from "@storyblok/svelte";
  import { page } from "$app/state";
  import { getLanguage } from "$lib/lang";
  import { createLinkResolver, highlightResolver, textStyleResolver } from "$lib/storyblok/rich-text";
  import type { TextSectionBlok } from "$lib/storyblok/types";

  let { blok }: { blok: TextSectionBlok } = $props();

  const textSizes: Record<string, string> = {
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem'
  };

  const maxWidths: Record<string, string> = {
    sm: '40rem',
    md: '48rem',
    lg: '64rem',
    xl: '80rem',
    full: '100%'
  };

  let lang = $derived(getLanguage(page.params.lang));
  let sectionStyles = $derived([
    blok.text_align ? `text-align: ${blok.text_align}` : '',
    blok.text_size && textSizes[blok.text_size] ? `font-size: ${textSizes[blok.text_size]}` : '',
    blok.text_color ? `color: ${blok.text_color}` : '',
    blok.max_width && maxWidths[blok.max_width] ? `max-width: ${maxWidths[blok.max_width]}` : '',
    blok.max_width && blok.max_width !== 'full' ? 'margin-inline: auto' : '',
    blok.custom_styles ?? ''
  ].filter(Boolean).join('; '));

  const renderedContent = $derived(
    (blok.content
      ? renderRichText(blok.content, {
          resolvers: {
            highlight: highlightResolver,
            link: createLinkResolver(lang),
            textStyle: textStyleResolver
          }
        })
      : "") || ""
  );
</script>

<div
  use:storyblokEditable={blok}
  class="text-section"
  class:has-text-size={!!(blok.text_size && textSizes[blok.text_size])}
  style={sectionStyles}
>
  {@html renderedContent}
</div>

<style>
  /*
   * The section is the typography context for its body copy. Keeping the
   * defaults here lets editor-authored, inheritable CSS declarations work as
   * normal CSS instead of requiring a property-by-property forwarding list.
   */
  .text-section {
    font-size: 1.125rem;
    line-height: 2rem;
  }

  .text-section :global(a) {
    color: var(--color-link, currentColor);
  }

  .text-section :global(a:hover) {
    color: var(--color-link-hover, var(--color-link, currentColor));
  }

  .text-section :global([data-rich-text-color] a) {
    color: inherit;
  }

  .text-section :global(p) {
    font-size: inherit;
    line-height: inherit;
  }

  .text-section.has-text-size :global(li),
  .text-section.has-text-size :global(blockquote) {
    font-size: inherit;
  }

  .text-section:not(.has-text-size) :global(li),
  .text-section:not(.has-text-size) :global(blockquote) {
    font-size: 1rem;
  }

  .text-section :global(blockquote) {
    line-height: normal;
  }
</style>
