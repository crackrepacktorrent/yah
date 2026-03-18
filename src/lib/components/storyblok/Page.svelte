<script lang="ts">
  import { storyblokEditable, StoryblokComponent } from "@storyblok/svelte";
  import type { PageBlok } from "$lib/storyblok/types";

  let { blok }: { blok: PageBlok } = $props();
</script>

{#key blok}
  <div use:storyblokEditable={blok} style={blok.custom_styles ?? ""}>
    {#each blok.body as bodyBlok}
      <StoryblokComponent blok={bodyBlok} />
    {/each}
  </div>
{/key}
