<script lang="ts">
  import { storyblokEditable, StoryblokComponent } from "@storyblok/svelte";
  import type { SectionBlok } from "$lib/storyblok/types";

  let { blok }: { blok: SectionBlok } = $props();
</script>

<section
  use:storyblokEditable={blok}
  class="section"
  style={blok.custom_styles ?? ""}
>
  {#each blok.blocks ?? [] as block}
    <StoryblokComponent blok={block} />
  {/each}
</section>

<style>
  .section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
