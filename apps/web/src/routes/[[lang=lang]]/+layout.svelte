<script lang="ts">
  import { StoryblokComponent, useStoryblokBridge } from "@storyblok/svelte";
  import Header from "$lib/components/storyblok/Header.svelte";
  import Lightbox from "$lib/components/Lightbox.svelte";
  import type { LayoutData } from "./$types";
  import type { ConfigBlok } from "$lib/storyblok/types";
  import { isPreviewMode } from "$lib/storyblok/helpers";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { SITE_URL } from '$lib/config';
  const umamiUrl = import.meta.env.VITE_UMAMI_URL;
  const umamiId = import.meta.env.VITE_UMAMI_WEBSITE_ID;

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  let configOverride = $state<ConfigBlok | null>(null);
  let header = $derived(configOverride?.header?.[0] ?? data.header);
  let footer = $derived(configOverride?.footer ?? data.footer);

  $effect(() => {
    void data.configStoryId;
    configOverride = null;
  });

  onMount(() => {
    if (data.configStoryId && data.isDraft && isPreviewMode()) {
      useStoryblokBridge(data.configStoryId, (newStory) => {
        const nextConfig = newStory.content as ConfigBlok | undefined;
        if (nextConfig?.component === 'config') configOverride = nextConfig;
      }, {
        preventClicks: true,
        resolveLinks: "story"
      });
    }
  });

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Youth Alliance for Housing',
    alternateName: 'YAH',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: 'A youth-led, member-led organization that builds power to radically transform the housing system.',
    sameAs: [
      'https://www.instagram.com/youth4housing/',
      'https://twitter.com/youth4housing'
    ]
  });

</script>

<svelte:head>
  {@html `<script type="application/ld+json">${jsonLd}</script>`}
  {#if umamiUrl && umamiId}
    <script async defer data-website-id={umamiId} src="{umamiUrl}/t"></script>
  {/if}
  {#if data.customCSSStyle}
    <!-- Custom CSS remains the server-validated version until a full reload. -->
    {@html data.customCSSStyle}
  {/if}
</svelte:head>

<a href="#main-content" class="skip-link">Skip to main content</a>

<div class="layout-container" data-sveltekit-reload={data.isDraft ? '' : undefined}>
  <header>
    <Header
      blok={header}
      lang={data.lang}
      dropdownCards={data.dropdownCards}
      isDraft={data.isDraft}
    />
  </header>
  <main id="main-content" class="layout-main" tabindex="-1">
    {@render children()}
  </main>
  {#each footer ?? [] as footerBlok (footerBlok._uid)}
    <StoryblokComponent blok={footerBlok} />
  {/each}
</div>

<Lightbox />

<style>
  .skip-link {
    position: absolute;
    left: -9999px;
    top: auto;
    width: 1px;
    height: 1px;
    overflow: hidden;
    z-index: 10000;
    padding: 0.75rem 1.5rem;
    background: var(--color-foreground);
    color: var(--color-background);
    text-decoration: none;
    font-weight: 600;
    border-radius: var(--radius-md);
  }

  .skip-link:focus {
    position: fixed;
    top: 1rem;
    left: 1rem;
    width: auto;
    height: auto;
  }

  :global(:where(body)) {
    background-color: var(--color-primary);
    color: var(--color-surface);
  }

  .layout-container {
    max-width: var(--layout-max-width, 1200px);
    min-height: 100vh;
    margin: 0 auto;
    padding: 1rem 1.5rem 0.5rem;
    display: flex;
    flex-direction: column;
  }

  .layout-main {
    flex: 1;
  }
</style>
