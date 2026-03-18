<script lang="ts">
  import { storyblokEditable } from "@storyblok/svelte";
  import type { SeparatorBlok } from "$lib/storyblok/types";

  let { blok }: { blok: SeparatorBlok } = $props();

  const sizeMap: Record<string, string> = {
    xs: '0.5rem',
    sm: '1rem',
    md: '2rem',
    lg: '4rem',
    xl: '6rem',
  };

  let type = $derived(blok.type ?? 'space');
  let size = $derived(sizeMap[blok.size ?? 'md'] ?? blok.custom_size ?? '1rem');
  let lineStyle = $derived(blok.line_style ?? 'solid');
  let lineColor = $derived(blok.line_color ?? 'var(--color-border)');
  let lineWidth = $derived(blok.line_width ?? '1px');

  let spaceStyle = $derived(`height: ${size}; width: 100%;`);
  let lineStyleStr = $derived(`
    background-color: ${lineColor};
    height: ${lineWidth};
    margin: ${size} 0;
    border: none;
    ${lineStyle === 'dashed' ? 'background: none; border-top: ' + lineWidth + ' dashed ' + lineColor + ';' : ''}
    ${lineStyle === 'dotted' ? 'background: none; border-top: ' + lineWidth + ' dotted ' + lineColor + ';' : ''}
  `.trim());
</script>

{#if type === 'space'}
  <div
    use:storyblokEditable={blok}
    style="{spaceStyle} {blok.custom_styles ?? ''}"
    aria-hidden="true"
  ></div>
{:else}
  <hr
    use:storyblokEditable={blok}
    class="separator-line"
    style="{lineStyleStr} {blok.custom_styles ?? ''}"
  />
{/if}

<style>
  .separator-line {
    width: 100%;
  }
</style>
