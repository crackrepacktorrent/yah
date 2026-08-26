<script lang="ts">
  import { storyblokEditable, StoryblokComponent } from "@storyblok/svelte";
  import { page } from "$app/state";
  import { getLanguage } from "$lib/lang";
  import { filterAndSortCards } from "$lib/storyblok/card-grid";
  import type { CardGridBlok } from "$lib/storyblok/types";
  import Dropdown from "./Dropdown.svelte";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";

  let { blok }: { blok: CardGridBlok } = $props();
  let lang = $derived(getLanguage(page.params.lang));

  let columns = $derived(Math.min(6, Math.max(1, Math.trunc(Number(blok.columns) || 3))));
  let tabletColumns = $derived(Math.min(6, Math.max(1, Math.trunc(Number(blok.tablet_columns) || 2))));
  let mobileColumns = $derived(Math.min(6, Math.max(1, Math.trunc(Number(blok.mobile_columns) || 1))));
  let gap = $derived(blok.gap ?? "24px");
  let equalHeightRows = $derived(blok.equal_height_rows ?? false);
  let fullWidthCards = $derived(blok.full_width_cards ?? false);
  let gridStyles = $derived(`
    --card-grid-desktop-columns: ${columns};
    --card-grid-tablet-columns: ${tabletColumns};
    --card-grid-mobile-columns: ${mobileColumns};
    gap: ${gap};
    ${equalHeightRows ? 'grid-auto-rows: 1fr;' : ''}
  `);
  let searchPlaceholder = $derived(blok.search_placeholder?.trim() || (lang === 'es' ? 'Buscar…' : 'Search…'));
  let sortOptions = $derived(blok.sort_options ?? []);
  let enableSearch = $derived(blok.enable_search ?? false);
  let enableSort = $derived(blok.enable_sort ?? false);

  let searchQuery = $state("");
  // svelte-ignore state_referenced_locally
  let sortBy = $state(blok.default_sort ?? "");

  function sortOptionLabel(option: string): string {
    const labels: Record<string, [string, string]> = {
      title: ['Title', 'Título'],
      date: ['Date', 'Fecha'],
      tags: ['Tags', 'Etiquetas'],
      category: ['Tags', 'Etiquetas']
    };
    return labels[option]?.[lang === 'es' ? 1 : 0]
      ?? `${option.charAt(0).toLocaleUpperCase()}${option.slice(1)}`;
  }

  const filteredAndSortedItems = $derived.by(() => {
    return filterAndSortCards(blok.cards, {
      query: enableSearch ? searchQuery : '',
      sortBy: enableSort ? sortBy : ''
    });
  });
</script>

<div
  use:storyblokEditable={blok}
  class="grid-container"
  style={blok.custom_styles ?? ''}
>
  {#if enableSearch || enableSort}
    <div class="grid-controls">
      {#if enableSearch}
        <input
          type="text"
          bind:value={searchQuery}
          placeholder={searchPlaceholder}
          class="search-input"
          aria-label={searchPlaceholder}
        />
      {/if}
      {#if enableSort && sortOptions.length > 0}
        <Dropdown
          id={`card-grid-sort-${blok._uid}`}
          openOnHover={false}
          items={sortOptions.map(opt => ({
            label: sortOptionLabel(opt),
            value: opt
          }))}
          onSelect={(value) => sortBy = value}
        >
          {#snippet trigger({ isOpen, menuId, triggerId, toggle })}
            <button
              id={triggerId}
              type="button"
              class="sort-button"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              aria-controls={menuId}
              onclick={toggle}
            >
              {sortBy ? sortOptionLabel(sortBy) : (lang === 'es' ? 'Ordenar por…' : 'Sort by…')}
              <ChevronDown class="chevron-icon" aria-hidden="true" />
            </button>
          {/snippet}
        </Dropdown>
      {/if}
    </div>
  {/if}

  <div class="grid" style={gridStyles}>
    {#each filteredAndSortedItems as item (item._uid)}
      <div class="grid-item" class:full-width={fullWidthCards}>
        <StoryblokComponent blok={item} />
      </div>
    {/each}
  </div>

  {#if filteredAndSortedItems.length === 0}
    <div class="empty-state">
      <p>{lang === 'es' ? 'No se encontraron resultados' : 'No items found'}</p>
    </div>
  {/if}
</div>

<style>
  .grid-container {
    width: 100%;
  }

  .grid-controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .search-input {
    flex: 1;
    min-width: 200px;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    border: 2px solid var(--grid-input-border, rgba(255, 255, 255, 0.3));
    border-radius: var(--radius-sm);
    background-color: var(--grid-input-bg, rgba(255, 255, 255, 0.1));
    color: var(--grid-input-color, var(--color-primary-foreground));
    outline: none;
    transition: border-color 150ms ease-in-out, background-color 150ms ease-in-out;
  }

  .search-input::placeholder {
    color: var(--grid-input-placeholder, rgba(255, 255, 255, 0.6));
  }

  .search-input:focus {
    border-color: var(--grid-input-border-focus, var(--color-primary-foreground));
    background-color: var(--grid-input-bg-focus, rgba(255, 255, 255, 0.15));
  }

  .sort-button {
    padding: 0.75rem 1rem;
    font-size: 1rem;
    font-weight: 400;
    border: 2px solid var(--grid-input-border, rgba(255, 255, 255, 0.3));
    border-radius: var(--radius-sm);
    background-color: var(--grid-input-bg, rgba(255, 255, 255, 0.1));
    color: var(--grid-input-color, var(--color-primary-foreground));
    outline: none;
    cursor: pointer;
    transition: border-color 150ms ease-in-out, background-color 150ms ease-in-out;
  }

  .sort-button:focus {
    border-color: var(--grid-input-border-focus, var(--color-primary-foreground));
    background-color: var(--grid-input-bg-focus, rgba(255, 255, 255, 0.15));
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(var(--card-grid-desktop-columns), 1fr);
  }

  @media (max-width: 1024px) {
    .grid {
      grid-template-columns: repeat(var(--card-grid-tablet-columns), 1fr);
    }
  }

  @media (max-width: 640px) {
    .grid {
      grid-template-columns: repeat(var(--card-grid-mobile-columns), 1fr);
    }
  }

  .grid-item {
    display: flex;
  }

  .grid-item.full-width :global(.card) {
    width: 100%;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--color-primary-foreground);
  }

  .empty-state p {
    font-size: 1.125rem;
    margin: 0;
  }

  :global(.chevron-icon) {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    margin-left: 0.25rem;
  }
</style>
