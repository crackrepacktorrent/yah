<script lang="ts">
  import { storyblokEditable, StoryblokComponent } from "@storyblok/svelte";
  import { page } from "$app/state";
  import { getLanguage } from "$lib/lang";
  import type { CardBlok } from "$lib/storyblok/types";
  import { getLocalizedLinkUrl } from "$lib/storyblok/client";

  let { blok }: { blok: CardBlok } = $props();

  let lang = $derived(getLanguage(page.params.lang));
  let locale = $derived(lang === 'es' ? 'es' : 'en-US');

  function formatDate(dateString: string, currentLocale: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(currentLocale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: /^\d{4}-\d{2}-\d{2}$/.test(dateString) ? 'UTC' : undefined
    });
  }

  let linkUrl = $derived(getLocalizedLinkUrl(blok.link, lang));
  let openInNewTab = $derived(blok.link?.target === '_blank');
  let linkText = $derived(blok.link_text?.trim() || (lang === 'es' ? 'Más información' : 'Learn more'));
  let formattedDate = $derived(blok.date ? formatDate(blok.date, locale) : '');
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
    <h3 class="card-title">
      {#if linkUrl}
        <a
          href={linkUrl}
          class="card-title-link"
          target={openInNewTab ? "_blank" : undefined}
          rel={openInNewTab ? "noopener noreferrer" : undefined}
        >
          {blok.title}
        </a>
      {:else}
        {blok.title}
      {/if}
    </h3>

    {#if formattedDate}
      <time class="card-date" datetime={blok.date}>{formattedDate}</time>
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

    {#if blok.metadata && blok.metadata.length > 0}
      <dl class="card-metadata">
        {#each blok.metadata as item}
          <div class="metadata-item">
            {#if item.icon}<span class="metadata-icon" aria-hidden="true">{item.icon}</span>{/if}
            {#if item.label}<dt>{item.label}</dt>{/if}
            <dd>{item.value}</dd>
          </div>
        {/each}
      </dl>
    {/if}

    {#if linkUrl}
      <a
        href={linkUrl}
        class="card-link-text"
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noopener noreferrer" : undefined}
      >
        {linkText} →
      </a>
    {/if}
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

  .card-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-foreground);
    margin: 0;
    line-height: 1.3;
  }

  .card-title-link {
    color: inherit;
    text-decoration: none;
  }

  .card-title-link:hover {
    text-decoration: underline;
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

  .card-metadata {
    display: grid;
    gap: 0.375rem;
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-muted);
  }

  .metadata-item {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .metadata-icon {
    line-height: inherit;
  }

  .metadata-item dt {
    font-weight: 600;
  }

  .metadata-item dt::after {
    content: ':';
  }

  .metadata-item dd {
    margin: 0;
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
