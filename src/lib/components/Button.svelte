<script lang="ts">
  import { storyblokEditable } from "@storyblok/svelte";
  import type { ButtonBlok } from "$lib/types/storyblok";
  import { getLinkUrl } from "$lib/utils/storyblok";

  let { blok }: { blok: ButtonBlok } = $props();

  let href = $derived(getLinkUrl(blok.link));
  let openInNewTab = $derived(blok.link?.target === '_blank');
  let size = $derived(blok.size ?? 'medium');
  let alignment = $derived(blok.alignment ?? 'center');
</script>

<a
  use:storyblokEditable={blok}
  {href}
  class="button button-{size} button-align-{alignment}"
  class:button-full-width={blok.full_width}
  target={openInNewTab ? "_blank" : undefined}
  rel={openInNewTab ? "noopener noreferrer" : undefined}
  style={blok.custom_styles ?? ""}
>
  {blok.text}
</a>

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    font-weight: 600;
    border-radius: var(--radius-sm);
    transition: all 150ms ease-in-out;
    cursor: pointer;
    border: 2px solid transparent;
    letter-spacing: 0.025em;
    background-color: var(--color-background);
    color: var(--color-primary);
  }

  .button:hover {
    background-color: var(--color-hover);
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
