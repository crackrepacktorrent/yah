<script lang="ts">
  import { StoryblokComponent } from "@storyblok/svelte";
  import Header from "$lib/components/storyblok/Header.svelte";
  import type { LayoutData } from "./$types";
  import { parse } from 'css-tree';
  import { page } from '$app/state';
  import { SITE_URL } from '$lib/config';
  const umamiUrl = import.meta.env.VITE_UMAMI_URL;
  const umamiId = import.meta.env.VITE_UMAMI_WEBSITE_ID;

  let { data, children }: { data: LayoutData; children: any } = $props();

  // Strip lang prefix to get the base path for hreflang alternates
  let basePath = $derived(
    page.url.pathname.startsWith('/es')
      ? page.url.pathname.slice(3) || '/'
      : page.url.pathname
  );

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

  let validatedCSS = $state('');
  let cssError = $state('');

  $effect(() => {
    console.log('Custom CSS from Storyblok:', data.customCSS);

    if (!data.customCSS || data.customCSS.trim() === '') {
      validatedCSS = '';
      cssError = '';
      console.log('No custom CSS provided');
      return;
    }

    try {
      // Parse CSS to validate syntax
      parse(data.customCSS);
      validatedCSS = data.customCSS;
      cssError = '';
      console.log('Custom CSS validated successfully');
      console.log('CSS being injected:', validatedCSS);
    } catch (error: any) {
      cssError = error.message;
      validatedCSS = '';
      console.error('Invalid CSS:', error.message);
      console.error('CSS content:', data.customCSS);
    }
  });
</script>

<svelte:head>
  <link rel="canonical" href="{SITE_URL}{page.url.pathname}" />
  <meta property="og:url" content="{SITE_URL}{page.url.pathname}" />
  <meta name="twitter:url" content="{SITE_URL}{page.url.pathname}" />
  <link rel="alternate" hreflang="en" href="{SITE_URL}{basePath}" />
  <link rel="alternate" hreflang="es" href="{SITE_URL}/es{basePath === '/' ? '' : basePath}" />
  <link rel="alternate" hreflang="x-default" href="{SITE_URL}{basePath}" />
  {@html `<script type="application/ld+json">${jsonLd}</script>`}
  {#if umamiUrl && umamiId}
    <script async defer data-website-id={umamiId} src="{umamiUrl}/t"></script>
  {/if}
  {#if validatedCSS}
    {@html `<style>${validatedCSS}</style>`}
  {/if}
</svelte:head>

{#if cssError}
  <div style="position: fixed; bottom: 1rem; right: 1rem; background: var(--color-destructive); color: var(--color-destructive-foreground); padding: 1rem; border-radius: var(--radius-lg); max-width: 400px; z-index: 9999; font-family: monospace; font-size: 0.875rem;">
    <strong>Custom CSS Error:</strong><br/>
    {cssError}
  </div>
{/if}

<a href="#main-content" class="skip-link">Skip to main content</a>

<div class="layout-container">
  <header>
    <Header
      blok={data.header}
      lang={data.lang}
      dropdownCards={data.dropdownCards}
    />
  </header>
  <main id="main-content" class="layout-main">
    {@render children()}
  </main>
  {#if data.footer && data.footer.length > 0}
    <StoryblokComponent blok={data.footer[0]} />
  {/if}
</div>

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

  :global(body) {
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
