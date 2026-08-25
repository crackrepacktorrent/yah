<script lang="ts">
  import { storyblokEditable, StoryblokComponent } from '@storyblok/svelte';
  import { onMount, setContext } from 'svelte';
  import { page } from '$app/state';
  import * as CarouselPrimitive from '$lib/components/ui/carousel';
  import { getLanguage } from '$lib/lang';
  import type { CarouselAPI } from '$lib/components/ui/carousel/context';
  import Autoplay from 'embla-carousel-autoplay';
  import type { CarouselBlok, ImageBlok } from '$lib/storyblok/types';
  import { CAROUSEL_GALLERY_KEY, type CarouselGalleryContext } from '$lib/stores/carousel-gallery';
  import type { LightboxImage } from '$lib/stores/lightbox.svelte';
  import { getSafeHttpUrl } from '$lib/storyblok/client';
  import { getStoryblokImageDimensions } from '$lib/storyblok/helpers';

  let { blok }: { blok: CarouselBlok } = $props();

  let lang = $derived(getLanguage(page.params.lang));
  let slides = $derived(blok.slides ?? []);
  let showArrows = $derived((blok.show_arrows ?? true) && slides.length > 1);
  let autoplayDelay = $derived(Math.max(1000, Number(blok.autoplay_delay) || 3000));
  let loop = $derived(blok.loop ?? true);
  let align = $derived(blok.align ?? 'center');
  let isImageGallery = $derived(slides.length > 0 && slides.every((slide) => slide.component === 'image'));
  let isPeekEffect = $derived(isImageGallery && align === 'center');

  let carouselApi = $state<CarouselAPI>();
  let selectedIndex = $state(0);
  let prefersReducedMotion = $state(true);

  let autoplayPlugin = $derived(Autoplay({
    delay: autoplayDelay,
    playOnInit: false,
    stopOnFocusIn: true,
    stopOnInteraction: false,
    stopOnMouseEnter: true
  }));
  let plugins = $derived(blok.autoplay && slides.length > 1 ? [autoplayPlugin] : []);
  let autoplayRunning = $derived(!!blok.autoplay && !prefersReducedMotion);

  onMount(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => {
      prefersReducedMotion = mediaQuery.matches;
    };
    updateMotionPreference();
    mediaQuery.addEventListener('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener('change', updateMotionPreference);
  });

  $effect(() => {
    if (!carouselApi) return;
    const api = carouselApi;
    const updateSelectedIndex = () => {
      selectedIndex = api.selectedScrollSnap();
    };
    updateSelectedIndex();
    api.on('select', updateSelectedIndex);
    api.on('reInit', updateSelectedIndex);
    return () => {
      api.off('select', updateSelectedIndex);
      api.off('reInit', updateSelectedIndex);
    };
  });

  $effect(() => {
    if (!carouselApi || !blok.autoplay || slides.length < 2) return;
    if (autoplayRunning) autoplayPlugin.play();
    else autoplayPlugin.stop();
    return () => autoplayPlugin.stop();
  });

  // Only direct image slides belong to this gallery. Nested images in arbitrary
  // carousel content keep their own standalone lightbox behavior.
  setContext<CarouselGalleryContext>(CAROUSEL_GALLERY_KEY, {
    images: () => {
      if (!isImageGallery) return [];
      const result: LightboxImage[] = [];
      for (const slide of slides) {
        const img = slide as ImageBlok;
        const src = getSafeHttpUrl(img.image?.filename);
        if (!src) continue;
        const dims = getStoryblokImageDimensions(src)
          ?? (img.image?.width && img.image?.height
            ? { width: img.image.width, height: img.image.height }
            : { width: 1600, height: 1200 });
        result.push({
          src,
          alt: img.alt_text ?? img.image?.alt ?? '',
          ...dims,
        });
      }
      return result;
    },
    indexOf: (blokUid) => {
      if (!isImageGallery) return -1;
      let galleryIndex = 0;
      for (const slide of slides) {
        const img = slide as ImageBlok;
        if (!getSafeHttpUrl(img.image?.filename)) continue;
        if (img._uid === blokUid) return galleryIndex;
        galleryIndex += 1;
      }
      return -1;
    }
  });
</script>

<div
  use:storyblokEditable={blok}
  class="carousel-wrapper"
  class:image-gallery={isImageGallery}
  class:peek-effect={isPeekEffect}
  style={blok.custom_styles ?? ''}
>
  <CarouselPrimitive.Root
    opts={{ align, loop }}
    {plugins}
    setApi={(api) => carouselApi = api}
    aria-label={lang === 'es' ? 'Carrusel de contenido' : 'Content carousel'}
    aria-live={autoplayRunning ? 'off' : 'polite'}
  >
    <CarouselPrimitive.Content>
      {#each slides as slide, index (slide._uid)}
        <CarouselPrimitive.Item
          class="carousel-item"
          aria-label={lang === 'es'
            ? `Diapositiva ${index + 1} de ${slides.length}`
            : `Slide ${index + 1} of ${slides.length}`}
          aria-hidden={selectedIndex !== index}
          inert={selectedIndex !== index ? true : undefined}
        >
          <StoryblokComponent blok={slide} />
        </CarouselPrimitive.Item>
      {/each}
    </CarouselPrimitive.Content>

    {#if showArrows}
      <CarouselPrimitive.Previous aria-label={lang === 'es' ? 'Diapositiva anterior' : 'Previous slide'} />
      <CarouselPrimitive.Next aria-label={lang === 'es' ? 'Diapositiva siguiente' : 'Next slide'} />
    {/if}

  </CarouselPrimitive.Root>
</div>

<style>
  .carousel-wrapper {
    position: relative;
    width: 100%;
  }

  .carousel-wrapper.image-gallery :global(.carousel-item) {
    height: 45vh;
  }

  .carousel-wrapper.image-gallery :global(.image-container) {
    height: 100%;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .carousel-wrapper.image-gallery :global(.image-container .image-frame) {
    min-height: 0;
    height: 100%;
  }

  .carousel-wrapper.image-gallery :global(.image-container .image-link) {
    width: 100%;
    height: 100%;
    margin: 0;
  }

  .carousel-wrapper.image-gallery :global(.image-container img) {
    height: 100%;
    width: 100%;
  }

  .carousel-wrapper.peek-effect :global([data-embla-slide]) {
    flex-basis: auto;
  }

  .carousel-wrapper.peek-effect :global(.image-container) {
    display: inline-grid;
    width: auto;
  }

  .carousel-wrapper.peek-effect :global(.image-container .image-frame) {
    width: auto;
  }

  .carousel-wrapper.peek-effect :global(.image-container .image-link) {
    display: inline-block;
    width: auto;
    height: 100%;
  }

  .carousel-wrapper.peek-effect :global(.image-container img) {
    width: auto;
    max-width: none;
    height: 100%;
  }

  @media (max-width: 1024px) {
    .carousel-wrapper.image-gallery :global(.carousel-item) {
      height: 40vh;
    }
  }

  @media (max-width: 640px) {
    .carousel-wrapper.image-gallery :global(.carousel-item) {
      height: 30vh;
    }
  }
</style>
