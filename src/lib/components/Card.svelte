<script lang="ts">
  import { storyblokEditable, StoryblokComponent } from "@storyblok/svelte";
  import type { CardBlok } from "$lib/types/storyblok";
  import { getLinkUrl } from "$lib/utils/storyblok";

  let { blok }: { blok: CardBlok } = $props();

  function formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  let linkUrl = $derived(getLinkUrl(blok.link));
  let openInNewTab = $derived(blok.link?.target === '_blank');
  let linkText = $derived(blok.link_text ?? 'Learn More');
  let formattedDate = $derived(blok.date ? formatDate(blok.date) : '');
</script>

<div
  use:storyblokEditable={blok}
  class="card"
  style={blok.custom_styles ?? ""}
>
  {#if blok.image && blok.image.length > 0}
    <div class="card-image">
      <StoryblokComponent blok={blok.image[0]} />
    </div>
  {/if}

  <div class="card-content">
    <a
      href={linkUrl}
      class="card-title-link"
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noopener noreferrer" : undefined}
    >
      <h3 class="card-title">{blok.title}</h3>
    </a>

    {#if formattedDate}
      <p class="card-date">{formattedDate}</p>
    {/if}

    {#if blok.description}
      <p class="card-description">{blok.description}</p>
    {/if}

    {#if blok.tags && blok.tags.length > 0}
      <div class="card-tags">
        {#each blok.tags as tag}
          <span class="tag">{tag}</span>
        {/each}
      </div>
    {/if}

    <a
      href={linkUrl}
      class="card-link-text"
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noopener noreferrer" : undefined}
    >
      {linkText} →
    </a>
  </div>
</div>

<style>
  .card {
    background-color: var(--color-surface);
    border-radius: var(--radius-md);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .card-image {
    flex-shrink: 0;
    overflow: hidden;
  }

  .card-content {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
  }

  .card-title-link {
    text-decoration: none;
    color: inherit;
    transition: color 150ms ease-in-out;
  }

  .card-title-link:hover {
    color: var(--color-primary);
  }

  .card-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-foreground);
    margin: 0;
    line-height: 1.3;
  }

  .card-title-link:hover .card-title {
    color: var(--color-primary);
  }

  .card-date {
    font-size: 0.75rem;
    color: var(--color-muted);
    margin: 0;
  }

  .card-description {
    font-size: 0.875rem;
    color: var(--color-muted);
    line-height: 1.5;
    margin: 0;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tag {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background-color: var(--color-secondary);
    color: var(--color-muted);
    border-radius: var(--radius-xs);
  }

  .card-link-text {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-primary);
    margin-top: auto;
    display: inline-block;
    text-decoration: none;
    transition: transform 150ms ease-in-out;
  }

  .card-link-text:hover {
    transform: translateX(4px);
  }
</style>
