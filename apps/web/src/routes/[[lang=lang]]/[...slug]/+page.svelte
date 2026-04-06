<script lang="ts">
  import { StoryblokComponent, useStoryblokBridge } from "@storyblok/svelte";
  import { shouldEnableBridge } from "$lib/storyblok/helpers";
  import type { PageData } from "./$types";
  import type { PageBlok } from "$lib/storyblok/types";
  import { onMount } from "svelte";
  import { SITE_URL } from '$lib/config';

  let { data }: { data: PageData } = $props();
  let bridgeOverride = $state<typeof data.story | null>(null);
  let story = $derived(bridgeOverride ?? data.story);
  let loaded = $state(false);

  let content = $derived(story?.content as PageBlok | undefined);
  let isHome = $derived(story?.slug === 'home');
  let pageTitle = $derived(content?.seo_title || story?.name || '');
  let fullTitle = $derived(isHome ? 'Youth Alliance for Housing' : `${pageTitle} | Youth Alliance for Housing`);
  let pageDescription = $derived(content?.seo_description || '');
  let ogImage = $derived(content?.og_image?.filename || `${SITE_URL}/og-image.png`);

  // Reset bridge override on navigation (new data.story)
  $effect(() => {
    void data.story;
    bridgeOverride = null;
  });

  onMount(() => {
    loaded = true;
    if (data.story && shouldEnableBridge()) {
      useStoryblokBridge(data.story.id, (newStory) => (bridgeOverride = newStory), {
        preventClicks: true,
        resolveLinks: "story",
      });
    }
  });
</script>

<svelte:head>
  {#if pageTitle}
    <title>{fullTitle}</title>
    <meta property="og:title" content={fullTitle} />
    <meta name="twitter:title" content={fullTitle} />
  {/if}
  {#if pageDescription}
    <meta name="description" content={pageDescription} />
    <meta property="og:description" content={pageDescription} />
    <meta name="twitter:description" content={pageDescription} />
  {/if}
  <meta property="og:image" content={ogImage} />
  <meta name="twitter:image" content={ogImage} />
</svelte:head>

{#if loaded && story?.content}
  <StoryblokComponent blok={story.content} />
{/if}
