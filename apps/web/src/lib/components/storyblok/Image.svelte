<script lang="ts">
  import { storyblokEditable } from "@storyblok/svelte";
  import { getContext } from "svelte";
  import { page } from "$app/state";
  import { getLanguage } from "$lib/lang";
  import { getSafeHttpUrl } from "$lib/storyblok/client";
  import type { ImageBlok } from "$lib/storyblok/types";
  import { lightbox, type LightboxImage } from "$lib/stores/lightbox.svelte";
  import { CAROUSEL_GALLERY_KEY, type CarouselGalleryContext } from "$lib/stores/carousel-gallery";
  import { getStoryblokImageDimensions } from "$lib/storyblok/helpers";
  import { getEditorToken, radiusValues } from "$lib/storyblok/editor-options";

  let { blok }: { blok: ImageBlok } = $props();

  function isStoryblokAssetUrl(value: string): boolean {
    try {
      const hostname = new URL(value).hostname.toLocaleLowerCase();
      return hostname === 'storyblok.com' || hostname.endsWith('.storyblok.com');
    } catch {
      return false;
    }
  }

  let lang = $derived(getLanguage(page.params.lang));
  let altText = $derived(blok.alt_text?.trim() || blok.image.alt?.trim() || "");
  let originalUrl = $derived(getSafeHttpUrl(blok.image?.filename));
  let dimensions = $derived(
    getStoryblokImageDimensions(originalUrl)
      ?? (blok.image?.width && blok.image?.height
        ? { width: blok.image.width, height: blok.image.height }
        : null)
  );
  // Storyblok CDN: /m/ enables auto WebP, /m/{w}x0/ resizes by width
  let isStoryblok = $derived(isStoryblokAssetUrl(originalUrl));
  let imageUrl = $derived(isStoryblok ? `${originalUrl}/m/` : originalUrl);
  let srcset = $derived(isStoryblok
    ? `${originalUrl}/m/400x0/ 400w, ${originalUrl}/m/800x0/ 800w, ${originalUrl}/m/1200x0/ 1200w, ${originalUrl}/m/1600x0/ 1600w`
    : undefined);
  let loading = $derived((blok.lazy_loading ?? true) ? 'lazy' as const : 'eager' as const);

  // In a carousel, images are clickable by default. Standalone images use the blok.clickable field.
  let gallery = getContext<CarouselGalleryContext | undefined>(CAROUSEL_GALLERY_KEY);
  let galleryImages = $derived(gallery?.images() ?? []);
  let galleryIndex = $derived(gallery?.indexOf(blok._uid)
    ?? galleryImages.findIndex((image) => image.src === originalUrl));
  let inCarouselGallery = $derived(galleryIndex >= 0);
  let clickable = $derived(!!originalUrl && (inCarouselGallery || (blok.clickable ?? false)));
  let sizes = $derived(inCarouselGallery ? '100vw' : '(max-width: 768px) 100vw, 1200px');
  let lightboxLabel = $derived(lang === 'es'
    ? `Ampliar ${altText || blok.caption || blok.image.title || 'imagen'}`
    : `Enlarge ${altText || blok.caption || blok.image.title || 'image'}`);

  let aspectRatio = $derived(blok.aspect_ratio ?? 'natural');
  let objectFit = $derived(blok.object_fit ?? (aspectRatio === 'natural' ? 'none' : 'cover'));
  let objectPosition = $derived(blok.object_position ?? 'center');
  let cornerRadius = $derived(getEditorToken(radiusValues, blok.corner_radius));
  let objectFitStyle = $derived(objectFit !== 'none' ? `object-fit: ${objectFit};` : '');
  let imgStyles = $derived(objectFitStyle + `object-position: ${objectPosition};` + (blok.img_custom_styles ? ` ${blok.img_custom_styles}` : ''));

  function openLightbox() {
    if (!originalUrl) return;

    if (gallery && galleryIndex >= 0 && galleryImages.length > 0) {
      lightbox.open(galleryImages, galleryIndex);
    } else {
      const dims = dimensions ?? { width: 1600, height: 1200 };
      lightbox.open([{ src: originalUrl, alt: altText, ...dims }], 0);
    }
  }
</script>

<figure
  use:storyblokEditable={blok}
  class="image-container"
  style={blok.custom_styles ?? ''}
>
  <div
    class="image-frame"
    class:has-aspect-ratio={aspectRatio !== 'natural'}
    class:has-corner-radius={cornerRadius !== undefined}
    style:aspect-ratio={aspectRatio !== 'natural' ? aspectRatio : undefined}
    style:border-radius={cornerRadius}
  >
    {#if originalUrl && clickable}
      <button type="button" class="image-link" onclick={openLightbox} aria-label={lightboxLabel}>
        <img
          src={imageUrl}
          srcset={srcset}
          {sizes}
          width={dimensions?.width}
          height={dimensions?.height}
          alt={altText}
          loading={loading}
          decoding="async"
          style={imgStyles}
        />
      </button>
    {:else if originalUrl}
      <img
        src={imageUrl}
        srcset={srcset}
        {sizes}
        width={dimensions?.width}
        height={dimensions?.height}
        alt={altText}
        loading={loading}
        decoding="async"
        style={imgStyles}
      />
    {/if}
  </div>
  {#if blok.caption}
    <figcaption class="caption">{blok.caption}</figcaption>
  {/if}
</figure>

<style>
  .image-container {
    width: 100%;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .image-frame {
    width: 100%;
  }

  /* The ratio belongs to the media frame so captions remain outside it. */
  .image-frame.has-aspect-ratio,
  .image-frame.has-corner-radius {
    overflow: hidden;
  }

  .image-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    text-decoration: none;
  }

  img {
    max-width: 100%;
    display: block;
    width: 100%;
  }

  /* Images with aspect-ratio fill their container */
  .image-frame.has-aspect-ratio img {
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
