<script lang="ts">
  import { storyblokEditable, renderRichText } from "@storyblok/svelte";
  import { page } from "$app/state";
  import { getLanguage } from "$lib/lang";
  import { createLinkResolver, highlightResolver, textStyleResolver } from "$lib/storyblok/rich-text";
  import {
    getEditorToken,
    lineHeightValues,
    maxWidthValues,
    paragraphSpacingValues,
    textAlignValues,
    textSizeValues
  } from "$lib/storyblok/editor-options";
  import type { TextSectionBlok } from "$lib/storyblok/types";

  let { blok }: { blok: TextSectionBlok } = $props();

  let lang = $derived(getLanguage(page.params.lang));
  let textAlign = $derived(getEditorToken(textAlignValues, blok.text_align));
  let textSize = $derived(getEditorToken(textSizeValues, blok.text_size));
  let bodyLineHeight = $derived(getEditorToken(lineHeightValues, blok.line_height));
  let paragraphSpacing = $derived(getEditorToken(paragraphSpacingValues, blok.paragraph_spacing));
  let maxWidth = $derived(getEditorToken(maxWidthValues, blok.max_width));
  let sectionStyles = $derived([
    textAlign ? `text-align: ${textAlign}` : '',
    textSize ? `font-size: ${textSize}` : '',
    bodyLineHeight ? `line-height: ${bodyLineHeight}` : '',
    paragraphSpacing !== undefined
      ? `--text-section-paragraph-spacing: ${paragraphSpacing}`
      : '',
    blok.text_color ? `color: ${blok.text_color}` : '',
    maxWidth ? `max-width: ${maxWidth}` : '',
    maxWidth && blok.max_width !== 'full' ? 'margin-inline: auto' : '',
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
  class:has-text-size={textSize !== undefined}
  class:has-line-height={bodyLineHeight !== undefined}
  class:has-paragraph-spacing={paragraphSpacing !== undefined}
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
    font-weight: 600;
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

  .text-section.has-line-height :global(li),
  .text-section.has-line-height :global(blockquote) {
    line-height: inherit;
  }

  .text-section:not(.has-text-size) :global(li),
  .text-section:not(.has-text-size) :global(blockquote) {
    font-size: 1rem;
  }

  .text-section:not(.has-line-height) :global(blockquote) {
    line-height: normal;
  }

  .text-section.has-paragraph-spacing :global(p:not(:last-child)) {
    margin-bottom: var(--text-section-paragraph-spacing);
  }
</style>
