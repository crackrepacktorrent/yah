<script lang="ts">
  import { storyblokEditable, StoryblokComponent } from "@storyblok/svelte";
  import type { GridBlok } from "$lib/storyblok/types";

  let { blok }: { blok: GridBlok } = $props();

  let columnCount = $derived(blok.column_count ?? 2);
  let customTemplate = $derived(blok.custom_template?.trim());
  let template = $derived(customTemplate || `repeat(${columnCount}, 1fr)`);
  let gap = $derived(blok.gap || '2rem');
  let equalHeightRows = $derived(blok.equal_height_rows ?? false);
  let gridStyles = $derived(`grid-template-columns: ${template}; gap: ${gap};${equalHeightRows ? ' grid-auto-rows: 1fr;' : ''} ${blok.custom_styles ?? ''}`);
</script>

<div
  use:storyblokEditable={blok}
  class="grid-container"
  style={gridStyles}
>
  {#each blok.blocks ?? [] as block}
    <StoryblokComponent blok={block} />
  {/each}
</div>

<style>
  .grid-container {
    display: grid;
    width: 100%;
  }

  /* Stack to single column on mobile */
  @media (max-width: 768px) {
    .grid-container {
      grid-template-columns: 1fr !important;
    }
  }
</style>
