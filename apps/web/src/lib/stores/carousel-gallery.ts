import type { LightboxImage } from './lightbox.svelte';

export const CAROUSEL_GALLERY_KEY = Symbol('carousel-gallery');

export type CarouselGalleryContext = {
  images: () => LightboxImage[];
  indexOf: (blokUid: string) => number;
};
