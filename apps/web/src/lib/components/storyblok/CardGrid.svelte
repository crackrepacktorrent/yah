<script lang="ts">
  import { storyblokEditable, StoryblokComponent } from "@storyblok/svelte";
  import { page } from "$app/state";
  import { getLanguage } from "$lib/lang";
  import type { CardGridBlok } from "$lib/storyblok/types";
  import Dropdown from "./Dropdown.svelte";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";

  let { blok }: { blok: CardGridBlok } = $props();
  let lang = $derived(getLanguage(page.params.lang));

  let columns = $derived(Math.min(6, Math.max(1, Math.trunc(Number(blok.columns) || 3))));
  let gap = $derived(blok.gap ?? "24px");
  let equalHeightRows = $derived(blok.equal_height_rows ?? false);
  let fullWidthCards = $derived(blok.full_width_cards ?? false);
  let gridStyles = $derived(`grid-template-columns: repeat(${columns}, 1fr); gap: ${gap};${equalHeightRows ? ' grid-auto-rows: 1fr;' : ''}`);
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
      tags: ['Tags', 'Etiquetas']
    };
    return labels[option]?.[lang === 'es' ? 1 : 0]
      ?? `${option.charAt(0).toLocaleUpperCase()}${option.slice(1)}`;
  }

  const filteredAndSortedItems = $derived.by(() => {
    let items = blok.cards ?? [];

    if (enableSearch && searchQuery) {
      items = items.filter((item) => {
        if (!item) return false;
        const searchableFields = [item.title, item.description, item.tags?.join(" ")];
        const searchText = searchableFields.filter(Boolean).join(" ").toLowerCase();
        return searchText.includes(searchQuery.toLowerCase());
      });
    }

    if (enableSort && sortBy) {
      items = [...items].sort((a, b) => {
        if (sortBy === 'title') {
          const aTitle = a.title || '';
          const bTitle = b.title || '';
          return aTitle.localeCompare(bTitle);
        } else if (sortBy === 'tags') {
          const aTag = a.tags?.[0] || '';
          const bTag = b.tags?.[0] || '';
          return aTag.localeCompare(bTag);
        } else if (sortBy === 'date') {
          const parsedADate = a.date ? new Date(a.date).getTime() : 0;
          const parsedBDate = b.date ? new Date(b.date).getTime() : 0;
          const aDate = Number.isFinite(parsedADate) ? parsedADate : 0;
          const bDate = Number.isFinite(parsedBDate) ? parsedBDate : 0;
          return bDate - aDate;
        }
        return 0;
      });
    }

    return items;
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
  }

  @media (max-width: 1024px) {
    .grid {
      grid-template-columns: repeat(2, 1fr) !important;
    }
  }

  @media (max-width: 640px) {
    .grid {
      grid-template-columns: 1fr !important;
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
