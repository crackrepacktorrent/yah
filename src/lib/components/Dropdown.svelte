<script lang="ts">
  import { fly } from 'svelte/transition';

  interface DropdownItem {
    label: string;
    value?: string;
    href?: string;
    target?: string;
    rel?: string;
  }

  let {
    items = [],
    trigger,
    onSelect,
    align = "left",
    class: className = "",
  }: {
    items: DropdownItem[];
    trigger: any;
    onSelect?: (value: string) => void;
    align?: "left" | "right";
    class?: string;
  } = $props();

  let isOpen = $state(false);
  const anchorName = `--dropdown-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div
  class="dropdown-wrapper {className}"
  role="group"
  onmouseenter={() => isOpen = true}
  onmouseleave={() => isOpen = false}
>
  <div class="dropdown-trigger" style="anchor-name: {anchorName};">
    {@render trigger()}
  </div>

  {#if isOpen}
    <div
      class="dropdown-menu"
      class:align-right={align === "right"}
      role="menu"
      style="position-anchor: {anchorName};"
      transition:fly={{ y: -10, duration: 200 }}
    >
      {#each items as item}
        {#if item.href}
          <a
            href={item.href}
            class="dropdown-item"
            role="menuitem"
            target={item.target}
            rel={item.rel}
          >
            {item.label}
          </a>
        {:else if onSelect}
          <button
            type="button"
            class="dropdown-item"
            role="menuitem"
            onclick={() => {
              onSelect?.(item.value || item.label);
              isOpen = false;
            }}
          >
            {item.label}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .dropdown-wrapper {
    display: inline-block;
  }

  .dropdown-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
  }

  .dropdown-menu {
    position: absolute;
    top: anchor(bottom);
    left: anchor(left);
    position-try-fallbacks: --flip-to-right;
    padding-top: 0.5rem;
    background-color: transparent;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    min-width: anchor-size(inline);
    width: max-content;
    z-index: 50;
    overflow: hidden;
  }

  .dropdown-menu.align-right {
    left: auto;
    right: anchor(right);
    position-try-fallbacks: --flip-to-left;
  }

  @position-try --flip-to-right {
    left: auto;
    right: anchor(right);
  }

  @position-try --flip-to-left {
    right: auto;
    left: anchor(left);
  }

  .dropdown-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.625rem 1rem;
    color: var(--color-yahrange);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    border: none;
    background-color: var(--background);
    transition: background-color 150ms ease-in-out;
    cursor: pointer;
  }

  .dropdown-item:first-child {
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }

  .dropdown-item:hover {
    background-color: var(--hover-bg);
  }
</style>
