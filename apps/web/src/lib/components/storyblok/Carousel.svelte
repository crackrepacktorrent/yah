<script lang="ts">
  import { storyblokEditable, StoryblokComponent } from "@storyblok/svelte";
  import { setContext } from "svelte";
  import * as CarouselPrimitive from "$lib/components/ui/carousel";
  import Autoplay from "embla-carousel-autoplay";
  import type { CarouselBlok, ImageBlok } from "$lib/storyblok/types";
  import { CAROUSEL_GALLERY_KEY, type CarouselGalleryContext } from "$lib/stores/carousel-gallery";
  import type { LightboxImage } from "$lib/stores/lightbox.svelte";
  import { getStoryblokImageDimensions } from "$lib/storyblok/helpers";

  let { blok }: { blok: CarouselBlok } = $props();

  let showArrows = $derived(blok.show_arrows ?? true);
  let autoplayDelay = $derived(Number(blok.autoplay_delay) || 3000);
  let loop = $derived(blok.loop ?? true);
  let align = $derived(blok.align ?? 'center');
  let plugins = $derived(blok.autoplay ? [Autoplay({ delay: autoplayDelay })] : []);
  let isPeekEffect = $derived(align === 'center');

  // Provide gallery context so child Image components know they're in a carousel
  // and can open the lightbox with sibling navigation
  setContext<CarouselGalleryContext>(CAROUSEL_GALLERY_KEY, {
    images: () => {
      const slides = blok.slides ?? [];
      const result: LightboxImage[] = [];
      for (const slide of slides) {
        if (slide.component === 'image') {
          const img = slide as ImageBlok;
          const dims = getStoryblokImageDimensions(img.image.filename) ?? { width: 1600, height: 1200 };
          result.push({
            src: img.image.filename,
            alt: img.alt_text ?? img.image.alt ?? '',
            ...dims,
          });
        }
      }
      return result;
    },
  });
</script>

<div
  use:storyblokEditable={blok}
  class="carousel-wrapper"
  class:peek-effect={isPeekEffect}
  style={blok.custom_styles ?? ""}
>
  <CarouselPrimitive.Root opts={{ align, loop }} {plugins}>
    <CarouselPrimitive.Content>
      {#each blok.slides ?? [] as slide}
        <CarouselPrimitive.Item class="carousel-item">
          <StoryblokComponent blok={slide} />
        </CarouselPrimitive.Item>
      {/each}
    </CarouselPrimitive.Content>
    {#if showArrows}
      <CarouselPrimitive.Previous />
      <CarouselPrimitive.Next />
    {/if}
  </CarouselPrimitive.Root>
</div>

<style>
  .carousel-wrapper {
    position: relative;
    width: 100%;
  }

  .carousel-wrapper :global(.carousel-item) {
    height: 45vh;
  }

  /* Carousel controls Image sizing via CSS variables and targeting */
  .carousel-wrapper :global(.image-container) {
    height: 100%;
    display: block;
  }

  .carousel-wrapper :global(.image-container .image-link) {
    width: 100%;
    height: 100%;
    margin: 0;
  }

  .carousel-wrapper :global(.image-container img) {
    height: 100%;
    width: 100%;
  }

  /* Peek effect - override Embla's flex-basis and Image sizing */
  .carousel-wrapper.peek-effect :global([data-embla-slide]) {
    flex-basis: auto;
  }

  .carousel-wrapper.peek-effect :global(.image-container) {
    display: inline-block;
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
    .carousel-wrapper :global(.carousel-item) {
      height: 40vh;
    }
  }

  @media (max-width: 640px) {
    .carousel-wrapper :global(.carousel-item) {
      height: 30vh;
    }
  }
</style>
