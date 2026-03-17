<script lang="ts">
  import { storyblokEditable } from "@storyblok/svelte";
  import type { PDFBlok } from "$lib/types/storyblok";

  let { blok }: { blok: PDFBlok } = $props();

  let pdfUrl = $derived(blok.pdf_file?.filename ?? "");
  let title = $derived(blok.title ?? "PDF Document");
  let spreadMode = $derived(blok.spread_mode ?? 'two-page-odd');
  let zoom = $derived(blok.zoom ?? 'auto');
  let customZoom = $derived(blok.custom_zoom ?? 100);
  let initialPage = $derived(blok.initial_page ?? 1);

  let viewerUrl = $derived.by(() => {
    if (!pdfUrl) return "";

    const queryParams = new URLSearchParams();
    queryParams.set('file', pdfUrl);

    const hashParams: string[] = [];

    if (initialPage > 1) {
      hashParams.push(`page=${initialPage}`);
    }

    if (zoom === 'custom' && customZoom) {
      hashParams.push(`zoom=${customZoom}`);
    } else if (zoom !== 'auto') {
      hashParams.push(`zoom=${zoom}`);
    }

    if (spreadMode === 'one-page') {
      hashParams.push('spread=none');
    } else if (spreadMode === 'two-page-odd') {
      hashParams.push('spread=odd');
    } else if (spreadMode === 'two-page-even') {
      hashParams.push('spread=even');
    }

    const hash = hashParams.length > 0 ? `#${hashParams.join('&')}` : '';
    return `/pdfjs/web/viewer.html?${queryParams.toString()}${hash}`;
  });

  let height = $derived(blok.height ?? '75vh');
  let minHeight = $derived(blok.min_height ?? '400px');

  let containerStyles = $derived(`
    height: ${height};
    ${minHeight ? `min-height: ${minHeight};` : ''}
    ${blok.custom_styles ?? ''}
  `.trim());
</script>

<div
  use:storyblokEditable={blok}
  class="pdf-container"
  style={containerStyles}
>
  {#if pdfUrl}
    <iframe
      {title}
      src={viewerUrl}
      width="100%"
      height="100%"
      aria-label={title}
    ></iframe>
  {:else}
    <div class="pdf-placeholder">
      <p>No PDF file selected</p>
    </div>
  {/if}
</div>

<style>
  .pdf-container {
    width: 100%;
    position: relative;
  }

  .pdf-container iframe {
    display: block;
    border: none;
  }

  .pdf-placeholder {
    width: 100%;
    height: 100%;
    min-height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--muted);
    border: 2px dashed var(--border);
    border-radius: var(--radius-md);
  }

  .pdf-placeholder p {
    color: var(--muted-foreground);
    margin: 0;
  }
</style>
