<script lang="ts">
  import { StoryblokComponent, useStoryblokBridge } from "@storyblok/svelte";
  import type { PageData } from "./$types";
  import { onMount } from "svelte";

  let { data }: { data: PageData } = $props();
  let bridgeOverride = $state<typeof data.story | null>(null);
  let story = $derived(bridgeOverride ?? data.story);
  let loaded = $state(false);

  // Reset bridge override on navigation (new data.story)
  $effect(() => {
    void data.story;
    bridgeOverride = null;
  });

  onMount(() => {
    loaded = true;
    if (data.story) {
      useStoryblokBridge(data.story.id, (newStory) => (bridgeOverride = newStory), {
        preventClicks: true,
        resolveLinks: "story",
      });
    }
  });
</script>

{#if loaded && story?.content}
  <StoryblokComponent blok={story.content} />
{/if}
