<script lang="ts">
  import { storyblokEditable, renderRichText } from "@storyblok/svelte";
  import type { StoryblokRichTextNodeResolver } from "@storyblok/svelte";
  import type { TextSectionBlok } from "$lib/storyblok/types";

  let { blok }: { blok: TextSectionBlok } = $props();

  const highlightResolver: StoryblokRichTextNodeResolver = (node, context) => {
    const { color, style, ...attributes } = node.attrs ?? {};
    const text = "text" in node ? node.text : "";

    if (typeof color !== "string" || color.trim() === "") {
      return context.render(
        "mark",
        { ...attributes, ...(style ? { style } : {}) },
        text
      );
    }

    const existingStyle = typeof style === "string" ? style.trim().replace(/;$/, "") : "";
    const highlightStyle = [
      existingStyle,
      `background-color: ${color}`,
      "color: inherit"
    ].filter(Boolean).join("; ");

    return context.render(
      "mark",
      {
        ...attributes,
        "data-color": color,
        style: `${highlightStyle};`
      },
      text
    );
  };

  // Render rich text from Storyblok and fix textAlign attributes
  // Fix: Convert textAlign attribute to style
  // Storyblok outputs textAlign="center" (JSX style) but browsers need style="text-align: center"
  // Also remove textAlign="null" which Storyblok outputs when no alignment is set
  const renderedContent = $derived(
    ((blok.content
      ? renderRichText(blok.content, {
          resolvers: { highlight: highlightResolver }
        })
      : "") || "")
      // First, remove textAlign="null" (invalid)
      .replace(/\s*textAlign="null"/g, '')
      // Case 1: Element already has style attribute - append to it
      .replace(/style="([^"]*)" textAlign="(left|center|right|justify)"/g, 'style="$1; text-align: $2"')
      .replace(/textAlign="(left|center|right|justify)" style="([^"]*)"/g, 'style="text-align: $1; $2"')
      // Case 2: Element has no style attribute - create one
      .replace(/textAlign="(left|center|right|justify)"/g, 'style="text-align: $1"')
  );
</script>

<div
  use:storyblokEditable={blok}
  class="text-section"
  style={blok.custom_styles ?? ""}
>
  {@html renderedContent}
</div>

<style>
  .text-section :global(a) {
    color: var(--color-link, currentColor);
  }

  .text-section :global(a:hover) {
    color: var(--color-link-hover, var(--color-link, currentColor));
  }
</style>
