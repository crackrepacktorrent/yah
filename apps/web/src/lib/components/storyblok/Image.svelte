<script lang="ts">
  import { storyblokEditable } from "@storyblok/svelte";
  import type { ImageBlok } from "$lib/storyblok/types";

  let { blok }: { blok: ImageBlok } = $props();

  let altText = $derived(blok.alt_text ?? blok.image.alt ?? "");
  let originalUrl = $derived(blok.image.filename);
  // Storyblok CDN: /m/ enables auto WebP, /m/{w}x0/ resizes by width
  let isStoryblok = $derived(originalUrl.includes('storyblok.com'));
  let imageUrl = $derived(isStoryblok ? `${originalUrl}/m/` : originalUrl);
  let srcset = $derived(isStoryblok
    ? `${originalUrl}/m/400x0/ 400w, ${originalUrl}/m/800x0/ 800w, ${originalUrl}/m/1200x0/ 1200w, ${originalUrl}/m/1600x0/ 1600w`
    : undefined);
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
    <a href={originalUrl} target="_blank" rel="noopener noreferrer" class="image-link">
      <img
        src={imageUrl}
        srcset={srcset}
        sizes="100vw"
        alt={altText}
        loading={loading}
        style={imgStyles}
      />
    </a>
  {:else}
    <img
      src={imageUrl}
      srcset={srcset}
      sizes="100vw"
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
