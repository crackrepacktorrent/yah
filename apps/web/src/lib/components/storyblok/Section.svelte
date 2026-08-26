<script lang="ts">
  import { storyblokEditable, StoryblokComponent } from "@storyblok/svelte";
  import {
    getEditorToken,
    maxWidthValues,
    spacingValues
  } from "$lib/storyblok/editor-options";
  import type { SectionBlok } from "$lib/storyblok/types";

  let { blok }: { blok: SectionBlok } = $props();

  let gap = $derived(getEditorToken(spacingValues, blok.gap));
  let marginTop = $derived(getEditorToken(spacingValues, blok.margin_top));
  let marginBottom = $derived(getEditorToken(spacingValues, blok.margin_bottom));
  let paddingY = $derived(getEditorToken(spacingValues, blok.padding_y));
  let maxWidth = $derived(getEditorToken(maxWidthValues, blok.max_width));
  let sectionStyles = $derived([
    gap !== undefined ? `gap: ${gap}` : '',
    marginTop !== undefined ? `margin-top: ${marginTop}` : '',
    marginBottom !== undefined ? `margin-bottom: ${marginBottom}` : '',
    paddingY !== undefined ? `padding-block: ${paddingY}` : '',
    maxWidth ? `max-width: ${maxWidth}` : '',
    maxWidth && blok.max_width !== 'full' ? 'margin-inline: auto' : '',
    blok.custom_styles ?? ''
  ].filter(Boolean).join('; '));
</script>

<section
  use:storyblokEditable={blok}
  class="section"
  style={sectionStyles}
>
  {#each blok.blocks ?? [] as block}
    <StoryblokComponent blok={block} />
  {/each}
</section>

<style>
  .section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
