<script lang="ts">
  import { storyblokEditable, renderRichText } from "@storyblok/svelte";
  import type { TextSectionBlok } from "$lib/storyblok/types";

  let { blok }: { blok: TextSectionBlok } = $props();

  // Render rich text from Storyblok and fix textAlign attributes
  // Fix: Convert textAlign attribute to style
  // Storyblok outputs textAlign="center" (JSX style) but browsers need style="text-align: center"
  // Also remove textAlign="null" which Storyblok outputs when no alignment is set
  const renderedContent = $derived(
    ((blok.content ? renderRichText(blok.content) : "") || "")
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
