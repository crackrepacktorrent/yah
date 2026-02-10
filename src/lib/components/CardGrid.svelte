<script lang="ts">
  import { storyblokEditable, StoryblokComponent } from "@storyblok/svelte";
  import type { CardGridBlok } from "$lib/types/storyblok";
  import Dropdown from "$lib/components/Dropdown.svelte";
  import ChevronDown from "lucide-svelte/icons/chevron-down";

  let { blok }: { blok: CardGridBlok } = $props();

  const columns = blok.columns ?? 3;
  const gap = blok.gap ?? "24px";
  const equalHeightRows = blok.equal_height_rows ?? false;
  const fullWidthCards = blok.full_width_cards ?? false;

  const gridStyles = `grid-template-columns: repeat(${columns}, 1fr); gap: ${gap};${equalHeightRows ? ' grid-auto-rows: 1fr;' : ''} ${blok.custom_styles ?? ''}`;
  const searchPlaceholder = blok.search_placeholder ?? "Search...";
  const sortOptions = blok.sort_options ?? [];
  const enableSearch = blok.enable_search ?? false;
  const enableSort = blok.enable_sort ?? false;

  let searchQuery = $state("");
  let sortBy = $state(blok.default_sort ?? (sortOptions.length > 0 ? sortOptions[0] : ""));

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
          const aDate = a.date ? new Date(a.date).getTime() : 0;
          const bDate = b.date ? new Date(b.date).getTime() : 0;
          return bDate - aDate;
        }
        return 0;
      });
    }

    return items;
  });
</script>

<div use:storyblokEditable={blok} class="grid-container">
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
          items={sortOptions.map(opt => ({
            label: opt.charAt(0).toUpperCase() + opt.slice(1),
            value: opt
          }))}
          onSelect={(value) => sortBy = value}
        >
          {#snippet trigger()}
            <button type="button" class="sort-button">
              {sortBy ? sortBy.charAt(0).toUpperCase() + sortBy.slice(1) : 'Sort by...'}
              <ChevronDown class="inline-block w-4 h-4 ml-1" />
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
      <p>No items found</p>
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
    color: var(--grid-input-color, white);
    outline: none;
    transition: border-color 0.2s, background-color 0.2s;
  }

  .search-input::placeholder {
    color: var(--grid-input-placeholder, rgba(255, 255, 255, 0.6));
  }

  .search-input:focus {
    border-color: var(--grid-input-border-focus, white);
    background-color: var(--grid-input-bg-focus, rgba(255, 255, 255, 0.15));
  }

  .sort-button {
    padding: 0.75rem 1rem;
    font-size: 1rem;
    border: 2px solid var(--grid-input-border, rgba(255, 255, 255, 0.3));
    border-radius: var(--radius-sm);
    background-color: var(--grid-input-bg, rgba(255, 255, 255, 0.1));
    color: var(--grid-input-color, white);
    outline: none;
    cursor: pointer;
    transition: border-color 0.2s, background-color 0.2s;
  }

  .sort-button:focus {
    border-color: var(--grid-input-border-focus, white);
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
    color: rgba(255, 255, 255, 0.7);
  }

  .empty-state p {
    font-size: 1.125rem;
    margin: 0;
  }
</style>
