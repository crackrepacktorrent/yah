<script lang="ts">
  import Shortlink from "$lib/components/Shortlink.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<div class="shortlinks-page">
  <h1 class="shortlinks-title">Shortlinks</h1>

  {#if data.shortlinks.length === 0}
    <p class="shortlinks-empty">No shortlinks configured. Add them in the <strong>config</strong> story's <strong>Shortlinks</strong> field in Storyblok.</p>
  {:else}
    <div class="shortlinks-list">
      {#each data.shortlinks as shortlink (shortlink._uid)}
        <Shortlink blok={shortlink} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .shortlinks-page {
  }

  .shortlinks-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #ff6f00;
    margin-bottom: 0.25rem;
  }

  .shortlinks-empty {
    color: #9ca3af;
    font-style: italic;
  }

  .shortlinks-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
