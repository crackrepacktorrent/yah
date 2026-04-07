export type LightboxImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

class LightboxState {
  images = $state<LightboxImage[]>([]);
  index = $state(0);
  trigger = $state(0);

  /**
   * Open the lightbox at a specific image. Bumping `trigger` lets the
   * Lightbox component reactively detect that an open was requested
   * (separate from `images`/`index` so reopening the same gallery still fires).
   */
  open(images: LightboxImage[], startIndex: number) {
    this.images = images;
    this.index = Math.max(0, Math.min(startIndex, images.length - 1));
    this.trigger++;
  }
}

export const lightbox = new LightboxState();
