<script lang="ts">
  import { StoryblokComponent } from "@storyblok/svelte";
  import Header from "$lib/components/Header.svelte";
  import type { LayoutData } from "./$types";
  import { parse } from 'css-tree';
  let { data, children }: { data: LayoutData; children: any } = $props();

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

<div class="layout-container">
  <header>
    <Header
      blok={data.header}
      lang={data.lang}
      dropdownCards={data.dropdownCards}
    />
  </header>
  <main class="layout-main">
    {@render children()}
  </main>
  {#if data.footer && data.footer.length > 0}
    <StoryblokComponent blok={data.footer[0]} />
  {/if}
</div>

<style>
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
