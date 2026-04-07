<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { lightbox } from '$lib/stores/lightbox.svelte';
  import PhotoSwipeLightbox from 'photoswipe/lightbox';
  import PhotoSwipe from 'photoswipe';
  import 'photoswipe/style.css';

  let pswpLightbox: PhotoSwipeLightbox | null = null;
  let lastTrigger = 0;

  onMount(() => {
    pswpLightbox = new PhotoSwipeLightbox({
      pswpModule: PhotoSwipe,
      // We supply data dynamically per open() — no static gallery selector
      imageClickAction: 'zoom',
      // Ensure click always zooms in further than the initial fit level,
      // even for images smaller than the viewport (where natural size < fit)
      secondaryZoomLevel: (zoomLevel) => zoomLevel.fit * 2,
    });
    pswpLightbox.init();
  });

  onDestroy(() => {
    pswpLightbox?.destroy();
    pswpLightbox = null;
  });

  $effect(() => {
    if (lightbox.trigger === lastTrigger) return;
    if (!pswpLightbox) return;

    lastTrigger = lightbox.trigger;

    pswpLightbox.loadAndOpen(lightbox.index, lightbox.images.map((img) => ({
      src: img.src,
      width: img.width,
      height: img.height,
      alt: img.alt,
    })));
  });
</script>
