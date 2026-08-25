<script lang="ts">
  import { onMount, tick, type Snippet } from 'svelte';
  import { fly } from 'svelte/transition';

  interface DropdownItem {
    label: string;
    value?: string;
    href?: string;
    target?: string;
    rel?: string;
  }

  interface DropdownTriggerState {
    isOpen: boolean;
    menuId: string;
    triggerId: string;
    toggle: () => void;
    open: () => void;
  }

  let {
    id,
    items = [],
    trigger,
    onSelect,
    align = 'left',
    openOnHover = true,
    openOnFocus = false,
    class: className = '',
  }: {
    id: string;
    items: DropdownItem[];
    trigger: Snippet<[DropdownTriggerState]>;
    onSelect?: (value: string) => void;
    align?: 'left' | 'right';
    openOnHover?: boolean;
    openOnFocus?: boolean;
    class?: string;
  } = $props();

  let isOpen = $state(false);
  let wrapper = $state<HTMLDivElement>();
  let menu = $state<HTMLDivElement>();

  const triggerId = $derived(`${id}-trigger`);
  const menuId = $derived(`${id}-menu`);

  function menuItems(): HTMLElement[] {
    return menu ? Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')) : [];
  }

  async function openDropdown(focus: 'first' | 'last' | false = false) {
    if (items.length === 0) return;
    isOpen = true;
    if (!focus) return;
    await tick();
    const focusableItems = menuItems();
    (focus === 'last' ? focusableItems.at(-1) : focusableItems[0])?.focus();
  }

  function closeDropdown(restoreFocus = false) {
    isOpen = false;
    if (restoreFocus) {
      const triggerElement = wrapper?.querySelector<HTMLElement>(`[id="${triggerId}"]`)
        ?? wrapper?.querySelector<HTMLElement>('.dropdown-trigger a, .dropdown-trigger button');
      triggerElement?.focus();
    }
  }

  function toggleDropdown() {
    if (isOpen) closeDropdown();
    else void openDropdown();
  }

  function handleFocusOut(event: FocusEvent) {
    if (!(event.relatedTarget instanceof Node) || !wrapper?.contains(event.relatedTarget)) {
      closeDropdown();
    }
  }

  function handleMouseLeave() {
    if (openOnHover && !wrapper?.contains(document.activeElement)) closeDropdown();
  }

  function handleMouseEnter() {
    if (openOnHover && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      void openDropdown();
    }
  }

  function handleFocusIn(event: FocusEvent) {
    if (openOnFocus && (event.target as HTMLElement | null)?.closest('.dropdown-trigger')) {
      void openDropdown();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const items = menuItems();
    const itemIndex = items.indexOf(target);

    if (target.closest('.dropdown-trigger')) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        void openDropdown(event.key === 'ArrowUp' ? 'last' : 'first');
      } else if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        closeDropdown(true);
      }
      return;
    }

    if (itemIndex < 0) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDropdown(true);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(itemIndex + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(itemIndex - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items.at(-1)?.focus();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const match = items.find((item) => item.textContent?.trim().toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
      if (match) {
        event.preventDefault();
        match.focus();
      }
    }
  }

  onMount(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (isOpen && event.target instanceof Node && !wrapper?.contains(event.target)) {
        closeDropdown();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  });

  $effect(() => {
    if (items.length === 0 && isOpen) closeDropdown();
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={wrapper}
  class="dropdown-wrapper {className}"
  role="group"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  onfocusin={handleFocusIn}
  onfocusout={handleFocusOut}
  onkeydown={handleKeydown}
>
  <div class="dropdown-trigger">
    {@render trigger({
      isOpen,
      menuId,
      triggerId,
      toggle: toggleDropdown,
      open: () => void openDropdown()
    })}
  </div>

  {#if isOpen && items.length > 0}
    <div
      bind:this={menu}
      id={menuId}
      class="dropdown-menu"
      class:align-right={align === 'right'}
      role="menu"
      aria-labelledby={triggerId}
      transition:fly={{ y: -8, duration: 150 }}
    >
      {#each items as item}
        {#if item.href}
          <a
            href={item.href}
            class="dropdown-item"
            role="menuitem"
            target={item.target}
            rel={item.rel}
            onclick={() => closeDropdown()}
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
              closeDropdown(true);
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
    position: relative;
    display: inline-block;
  }

  .dropdown-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    padding-top: 0.5rem;
    min-width: 100%;
    width: max-content;
    z-index: 50;
    filter: drop-shadow(var(--shadow-md));
  }

  .dropdown-menu.align-right {
    right: 0;
    left: auto;
  }

  .dropdown-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.625rem 1rem;
    color: var(--color-primary);
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    border: none;
    background-color: var(--color-background);
    transition: background-color 150ms ease-in-out;
    cursor: pointer;
  }

  .dropdown-item:first-child {
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }

  .dropdown-item:last-child {
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }

  .dropdown-item:only-child {
    border-radius: var(--radius-md);
  }

  .dropdown-item:hover,
  .dropdown-item:focus-visible {
    background-color: var(--color-hover);
    outline: none;
  }
</style>
