<script lang="ts">
  import { storyblokEditable } from "@storyblok/svelte";
  import type { ImageBlok } from "$lib/types/storyblok";

  let { blok }: { blok: ImageBlok } = $props();

  let altText = $derived(blok.alt_text ?? blok.image.alt ?? "");
  let imageUrl = $derived(blok.image.filename);
  let loading = $derived((blok.lazy_loading ?? true) ? 'lazy' as const : 'eager' as const);
  let clickable = $derived(blok.clickable ?? false);
  let aspectRatio = $derived(blok.aspect_ratio ?? 'natural');
  let objectFit = $derived(blok.object_fit ?? (aspectRatio === 'natural' ? 'none' : 'cover'));
  let objectPosition = $derived(blok.object_position ?? 'center');
  let containerStyles = $derived(aspectRatio !== 'natural' ? `aspect-ratio: ${aspectRatio};` : '');
  let objectFitStyle = $derived(objectFit !== 'none' ? `object-fit: ${objectFit};` : '');
  let imgStyles = $derived(objectFitStyle + `object-position: ${objectPosition};` + (blok.img_custom_styles ? ` ${blok.img_custom_styles}` : ''));
</script>

<div
  use:storyblokEditable={blok}
  class="image-container"
  class:has-aspect-ratio={aspectRatio !== 'natural'}
  style="{containerStyles} {blok.custom_styles ?? ''}"
>
  {#if clickable}
    <a href={imageUrl} target="_blank" rel="noopener noreferrer" class="image-link">
      <img
        src={imageUrl}
        alt={altText}
        loading={loading}
        style={imgStyles}
      />
    </a>
  {:else}
    <img
      src={imageUrl}
      alt={altText}
      loading={loading}
      style={imgStyles}
    />
  {/if}
  {#if blok.caption}
    <p class="caption">{blok.caption}</p>
  {/if}
</div>

<style>
  .image-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* When aspect-ratio is set, container becomes a frame */
  .image-container.has-aspect-ratio {
    overflow: hidden;
  }

  .image-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    cursor: pointer;
    text-decoration: none;
  }

  img {
    max-width: 100%;
    display: block;
    width: 100%;
  }

  /* Images with aspect-ratio fill their container */
  .has-aspect-ratio img {
    height: 100%;
    object-fit: cover; /* Default, can be overridden by blok.object_fit */
  }

  .caption {
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--color-primary-foreground);
    text-align: center;
    margin: 0;
  }
</style>
