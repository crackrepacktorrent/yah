<script lang="ts">
  import { StoryblokComponent, useStoryblokBridge } from "@storyblok/svelte";
  import { isPreviewMode } from "$lib/storyblok/helpers";
  import type { PageData } from "./$types";
  import type { PageBlok } from "$lib/storyblok/types";
  import { SITE_URL } from '$lib/config';
  import { page } from '$app/state';
  import { onMount } from 'svelte';

  function storyPath(slug?: string): string {
    const normalized = (slug ?? '')
      .trim()
      .replace(/^\/+|\/+$/g, '')
      .replace(/^(?:en|es)(?:\/|$)/, '');
    return !normalized || normalized === 'home' ? '/' : `/${normalized}`;
  }

  let { data }: { data: PageData } = $props();
  let bridgeOverride = $state<typeof data.story | null>(null);
  let story = $derived(bridgeOverride ?? data.story);

  let content = $derived(story?.content as PageBlok | undefined);
  let isHome = $derived(story?.slug === 'home');
  let pageTitle = $derived(content?.seo_title || story?.name || 'Youth Alliance for Housing');
  let fullTitle = $derived(
    isHome
      ? (content?.seo_title || 'Youth Alliance for Housing')
      : `${pageTitle} | Youth Alliance for Housing`
  );
  let pageDescription = $derived(
    content?.seo_description ||
    'The Youth Alliance for Housing (YAH) is a youth-led, member-led organization that builds power to radically transform the housing system.'
  );
  let ogImage = $derived(content?.og_image?.filename || `${SITE_URL}/og-image.png`);
  let canonicalPath = $derived(page.url.pathname.replace(/\/$/, '') || '/');
  let englishPath = $derived(storyPath(story?.full_slug || story?.slug));
  let translatedSlugs = $derived(
    Array.isArray(story?.translated_slugs) ? story.translated_slugs : []
  );
  let spanishTranslation = $derived(
    translatedSlugs.find((translation: { lang?: string }) => translation.lang === 'es')
  );
  // The site uses Storyblok field-level localization with English fallback, so
  // every published page has a valid /es route even when its slug is unchanged.
  let spanishBasePath = $derived(
    spanishTranslation?.path ? storyPath(spanishTranslation.path) : englishPath
  );
  let spanishPath = $derived(spanishBasePath === '/' ? '/es' : `/es${spanishBasePath}`);

  // Reset bridge override on navigation (new data.story)
  $effect(() => {
    void data.story;
    bridgeOverride = null;
  });

  onMount(() => {
    if (data.story?.id && data.isDraft && isPreviewMode()) {
      // The SDK does not expose an unsubscribe handle. Draft links force a full
      // navigation from the parent layout, keeping this to one listener per page.
      useStoryblokBridge(data.story.id, (newStory) => (bridgeOverride = newStory), {
        preventClicks: false
      });
    }
  });
</script>

<svelte:head>
  <title>{fullTitle}</title>
  <meta name="description" content={pageDescription} />
  <meta property="og:type" content="website" />
  <meta property="og:title" content={fullTitle} />
  <meta property="og:description" content={pageDescription} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:url" content="{SITE_URL}{canonicalPath}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={fullTitle} />
  <meta name="twitter:description" content={pageDescription} />
  <meta name="twitter:image" content={ogImage} />
  <meta name="twitter:url" content="{SITE_URL}{canonicalPath}" />
  <meta name="twitter:site" content="@youth4housing" />
  <meta name="twitter:creator" content="@youth4housing" />
  <link rel="canonical" href="{SITE_URL}{canonicalPath}" />
  <link rel="alternate" hreflang="en" href="{SITE_URL}{englishPath}" />
  <link rel="alternate" hreflang="es" href="{SITE_URL}{spanishPath}" />
  <link rel="alternate" hreflang="x-default" href="{SITE_URL}{englishPath}" />
  {#if data.isDraft || isPreviewMode()}
    <meta name="robots" content="noindex,nofollow,noarchive" />
  {/if}
</svelte:head>

{#if story?.content}
  <StoryblokComponent blok={story.content} />
{/if}
