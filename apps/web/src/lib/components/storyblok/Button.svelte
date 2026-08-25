<script lang="ts">
  import { storyblokEditable } from "@storyblok/svelte";
  import { page } from "$app/state";
  import { getLanguage } from "$lib/lang";
  import type { ButtonBlok } from "$lib/storyblok/types";
  import { getLocalizedLinkUrl } from "$lib/storyblok/client";

  let { blok }: { blok: ButtonBlok } = $props();

  let lang = $derived(getLanguage(page.params.lang));
  let href = $derived(getLocalizedLinkUrl(blok.link, lang));
  let openInNewTab = $derived(blok.link?.target === '_blank');
  let size = $derived(blok.size ?? 'medium');
  let alignment = $derived(blok.alignment ?? 'center');
  let variant = $derived(blok.variant ?? 'primary');
</script>

{#if href}
  <a
    use:storyblokEditable={blok}
    {href}
    class="button button-{variant} button-{size} button-align-{alignment}"
    class:button-full-width={blok.full_width}
    target={openInNewTab ? "_blank" : undefined}
    rel={openInNewTab ? "noopener noreferrer" : undefined}
    style={blok.custom_styles ?? ""}
  >
    {blok.text}
  </a>
{:else}
  <span
    use:storyblokEditable={blok}
    class="button button-{variant} button-{size} button-align-{alignment} button-disabled"
    class:button-full-width={blok.full_width}
    style={blok.custom_styles ?? ""}
  >
    {blok.text}
  </span>
{/if}

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    font-weight: 600;
    border-radius: var(--radius-sm);
    transition:
      background-color 150ms ease-in-out,
      border-color 150ms ease-in-out,
      color 150ms ease-in-out;
    cursor: pointer;
    border: 2px solid transparent;
    letter-spacing: 0.025em;
    background-color: var(--color-background);
    color: var(--color-primary);
  }

  .button:hover {
    background-color: var(--color-hover);
  }

  .button-secondary {
    background-color: var(--color-secondary);
    color: var(--color-secondary-foreground, var(--color-foreground));
  }

  .button-secondary:hover {
    background-color: var(--color-secondary-hover, var(--color-hover));
  }

  .button-text {
    padding-inline: 0;
    border-color: transparent;
    background-color: transparent;
    color: var(--color-link, currentColor);
  }

  .button-text:hover {
    background-color: transparent;
    color: var(--color-link-hover, var(--color-link, currentColor));
    text-decoration: underline;
  }

  .button-disabled {
    cursor: default;
    opacity: 0.65;
    pointer-events: none;
  }

  /* Sizes */
  .button-small {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
  }

  .button-medium {
    padding: 0.5rem 1rem;
    font-size: 1rem;
  }

  .button-large {
    padding: 0.75rem 1.5rem;
    font-size: 1.125rem;
  }

  /* Alignment (works in both flex and grid containers) */
  .button-align-left {
    align-self: flex-start;
    justify-self: start;
  }

  .button-align-center {
    align-self: center;
    justify-self: center;
  }

  .button-align-right {
    align-self: flex-end;
    justify-self: end;
  }

  /* Full width */
  .button-full-width {
    display: flex;
    width: 100%;
    align-self: stretch;
  }
</style>
