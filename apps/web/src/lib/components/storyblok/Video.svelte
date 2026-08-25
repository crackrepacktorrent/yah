<script lang="ts">
  import { storyblokEditable } from '@storyblok/svelte';
  import { page } from '$app/state';
  import { getLanguage } from '$lib/lang';
  import { getSafeHttpUrl } from '$lib/storyblok/client';
  import type { VideoBlok } from '$lib/storyblok/types';

  let { blok }: { blok: VideoBlok } = $props();
  let lang = $derived(getLanguage(page.params.lang));

  const aspectRatioMap: Record<string, string | undefined> = {
    '16:9': '16 / 9',
    '4:3': '4 / 3',
    '21:9': '21 / 9',
    '1:1': '1',
    none: undefined
  };

  type EmbedVideo = { src: string; provider: 'YouTube' | 'Vimeo' };

  function parseUrl(value: string): URL | null {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
    } catch {
      return null;
    }
  }

  function getYouTubeId(url: URL): string {
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] ?? '';
    if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) return '';

    const parts = url.pathname.split('/').filter(Boolean);
    if (url.pathname === '/watch') return url.searchParams.get('v') ?? '';
    if (['embed', 'shorts', 'live'].includes(parts[0] ?? '')) return parts[1] ?? '';
    return '';
  }

  function getEmbedVideo(value: string): EmbedVideo | null {
    const url = parseUrl(value);
    if (!url) return null;

    const youtubeId = getYouTubeId(url);
    if (/^[\w-]{6,}$/.test(youtubeId)) {
      const params = new URLSearchParams();
      if (blok.autoplay) params.set('autoplay', '1');
      if (blok.muted) params.set('mute', '1');
      if (blok.controls === false) params.set('controls', '0');
      if (blok.loop) {
        params.set('loop', '1');
        params.set('playlist', youtubeId);
      }
      const query = params.size > 0 ? `?${params}` : '';
      return { src: `https://www.youtube-nocookie.com/embed/${youtubeId}${query}`, provider: 'YouTube' };
    }

    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const videoId = url.pathname.split('/').filter(Boolean).findLast((part) => /^\d+$/.test(part)) ?? '';
      if (videoId) {
        const params = new URLSearchParams();
        if (blok.autoplay) params.set('autoplay', '1');
        if (blok.muted) params.set('muted', '1');
        if (blok.loop) params.set('loop', '1');
        if (blok.controls === false) params.set('controls', '0');
        const query = params.size > 0 ? `?${params}` : '';
        return { src: `https://player.vimeo.com/video/${videoId}${query}`, provider: 'Vimeo' };
      }
    }

    return null;
  }

  let rawVideoUrl = $derived(blok.video_url?.trim() || blok.video_file?.filename || '');
  let safeVideoUrl = $derived(getSafeHttpUrl(rawVideoUrl));
  let embedVideo = $derived(getEmbedVideo(safeVideoUrl));
  let posterUrl = $derived(getSafeHttpUrl(blok.poster_image?.filename));
  let showControls = $derived(blok.controls ?? true);
  let aspectRatio = $derived(aspectRatioMap[blok.aspect_ratio ?? '16:9']);
  let playerTitle = $derived(blok.title?.trim() || (lang === 'es'
    ? `Reproductor de video${embedVideo ? ` de ${embedVideo.provider}` : ''}`
    : `${embedVideo?.provider ? `${embedVideo.provider} ` : ''}video player`));
  let mediaStyles = $derived(blok.video_custom_styles ?? '');
</script>

<div use:storyblokEditable={blok} class="video-container" style={blok.custom_styles ?? ''}>
  {#if embedVideo}
    <div class:video-aspect-wrapper={!!aspectRatio} class="video-player" style:aspect-ratio={aspectRatio}>
      <iframe
        src={embedVideo.src}
        title={playerTitle}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowfullscreen
        loading="lazy"
        referrerpolicy="strict-origin-when-cross-origin"
        style={mediaStyles}
      ></iframe>
    </div>
  {:else if safeVideoUrl}
    <div class:video-aspect-wrapper={!!aspectRatio} class="video-player" style:aspect-ratio={aspectRatio}>
      <video
        src={safeVideoUrl}
        poster={posterUrl || undefined}
        autoplay={blok.autoplay}
        loop={blok.loop}
        muted={blok.muted}
        controls={showControls}
        playsinline
        preload="metadata"
        aria-label={playerTitle || 'Video player'}
        style={mediaStyles}
      >
        {lang === 'es' ? 'Tu navegador no admite la etiqueta de video.' : 'Your browser does not support the video tag.'}
      </video>
    </div>
  {/if}
</div>

<style>
  .video-container,
  .video-player {
    width: 100%;
  }

  .video-aspect-wrapper {
    overflow: hidden;
  }

  .video-aspect-wrapper iframe,
  .video-aspect-wrapper video {
    width: 100%;
    height: 100%;
  }

  iframe,
  video {
    max-width: 100%;
    display: block;
    border: 0;
  }
</style>
