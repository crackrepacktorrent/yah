<script lang="ts">
  import { storyblokEditable, StoryblokComponent } from "@storyblok/svelte";
  import type { GridBlok } from "$lib/storyblok/types";

  let { blok }: { blok: GridBlok } = $props();

  let columnCount = $derived(blok.column_count ?? 2);
  let customTemplate = $derived(blok.custom_template?.trim());
  let template = $derived(customTemplate || `repeat(${columnCount}, 1fr)`);
  let tabletColumns = $derived.by(() => {
    const value = blok.tablet_columns as string | number | null | undefined;
    if (value === undefined || value === null || value === '' || value === 'inherit') return null;
    return Math.min(4, Math.max(1, Math.trunc(Number(value) || 1)));
  });
  let mobileColumns = $derived(Math.min(4, Math.max(1, Math.trunc(Number(blok.mobile_columns) || 1))));
  let gap = $derived(blok.gap || '2rem');
  let equalHeightRows = $derived(blok.equal_height_rows ?? false);
  let gridStyles = $derived(`
    --grid-desktop-template: ${template};
    --grid-tablet-template: ${tabletColumns ? `repeat(${tabletColumns}, 1fr)` : 'var(--grid-desktop-template)'};
    --grid-mobile-template: repeat(${mobileColumns}, 1fr);
    gap: ${gap};
    ${equalHeightRows ? 'grid-auto-rows: 1fr;' : ''}
    ${blok.custom_styles ?? ''}
  `);
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
    grid-template-columns: var(--grid-desktop-template);
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    .grid-container {
      grid-template-columns: var(--grid-tablet-template);
    }
  }

  @media (max-width: 768px) {
    .grid-container {
      grid-template-columns: var(--grid-mobile-template);
    }
  }
</style>
