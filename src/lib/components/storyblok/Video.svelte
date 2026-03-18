<script lang="ts">
  import { storyblokEditable } from "@storyblok/svelte";
  import type { VideoBlok } from "$lib/storyblok/types";

  let { blok }: { blok: VideoBlok } = $props();

  const aspectRatioMap: Record<string, string | undefined> = {
    '16:9': '56.25%',
    '4:3': '75%',
    '21:9': '42.857%',
    '1:1': '100%',
    'none': undefined
  };

  function getEmbedUrl(url: string): string {
    if (url.includes("youtube.com/watch")) {
      const videoId = url.split("v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes("youtu.be/")) {
      const videoId = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes("vimeo.com/")) {
      const videoId = url.split("vimeo.com/")[1]?.split("?")[0];
      return `https://player.vimeo.com/video/${videoId}`;
    }
    return url;
  }

  let videoUrl = $derived(blok.video_url ?? blok.video_file?.filename ?? "");
  let isEmbedded = $derived(videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be") || videoUrl.includes("vimeo.com"));
  let posterUrl = $derived(blok.poster_image?.filename ?? "");
  let showControls = $derived(blok.controls ?? true);
  let paddingBottom = $derived(aspectRatioMap[blok.aspect_ratio ?? '16:9']);
  let embedUrl = $derived(isEmbedded ? getEmbedUrl(videoUrl) : "");
</script>

<div use:storyblokEditable={blok} class="video-container" style={blok.custom_styles ?? ""}>
  {#if isEmbedded}
    {#if paddingBottom}
      <div class="video-aspect-wrapper" style="padding-bottom: {paddingBottom};">
        <iframe
          src={embedUrl}
          title="Video player"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          style={blok.video_custom_styles ?? ""}
        ></iframe>
      </div>
    {:else}
      <iframe
        src={embedUrl}
        title="Video player"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        style={blok.video_custom_styles ?? ""}
      ></iframe>
    {/if}
  {:else if videoUrl}
    {#if paddingBottom}
      <div class="video-aspect-wrapper" style="padding-bottom: {paddingBottom};">
        <video
          src={videoUrl}
          poster={posterUrl}
          autoplay={blok.autoplay}
          loop={blok.loop}
          muted={blok.muted}
          controls={showControls}
          aria-label="Video player"
          style={blok.video_custom_styles ?? ""}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    {:else}
      <video
        src={videoUrl}
        poster={posterUrl}
        autoplay={blok.autoplay}
        loop={blok.loop}
        muted={blok.muted}
        controls={showControls}
        aria-label="Video player"
        style={blok.video_custom_styles ?? ""}
      >
        Your browser does not support the video tag.
      </video>
    {/if}
  {/if}
</div>

<style>
  .video-container {
    width: 100%;
  }

  .video-aspect-wrapper {
    position: relative;
    width: 100%;
    height: 0;
    overflow: hidden;
  }

  .video-aspect-wrapper iframe,
  .video-aspect-wrapper video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  iframe,
  video {
    max-width: 100%;
    display: block;
  }
</style>
