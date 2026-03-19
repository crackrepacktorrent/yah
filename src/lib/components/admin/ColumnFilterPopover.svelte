<script lang="ts" generics="TData">
	import type { Column } from '@tanstack/table-core';
	import { Popover } from 'bits-ui';

	let {
		column,
	}: {
		column: Column<TData, unknown>;
	} = $props();

	let open = $state(false);
	let search = $state('');

	// We use a sentinel to represent "nothing selected" since TanStack
	// normalizes empty arrays to undefined (which means "no filter").
	const NONE_SELECTED = '__$$none$$__';

	let facetedValues = $derived(column.getFacetedUniqueValues());
	let rawFilterValue = $derived(column.getFilterValue() as unknown[] | undefined);
	let noneSelected = $derived(
		Array.isArray(rawFilterValue) && rawFilterValue.length === 1 && rawFilterValue[0] === NONE_SELECTED,
	);
	let filterValue = $derived(noneSelected ? [] : (rawFilterValue ?? []));
	let isFiltered = $derived(rawFilterValue != null && rawFilterValue.length > 0);
	let allSelected = $derived(!isFiltered);

	let entries = $derived.by(() => {
		const result: { value: unknown; label: string; count: number }[] = [];
		for (const [value, count] of facetedValues) {
			const label = value == null ? '(empty)' : String(value);
			result.push({ value, label, count });
		}
		result.sort((a, b) => a.label.localeCompare(b.label));
		return result;
	});

	let filteredEntries = $derived(
		search
			? entries.filter((e) => e.label.toLowerCase().includes(search.toLowerCase()))
			: entries,
	);

	let allValues = $derived(entries.map((e) => e.value));
	let someSelected = $derived(!allSelected && !noneSelected && filterValue.length > 0);

	function toggleValue(value: unknown) {
		if (allSelected) {
			// First uncheck: include everything except this value
			const included = allValues.filter((v) => v !== value);
			column.setFilterValue(included.length > 0 ? included : [NONE_SELECTED]);
		} else if (noneSelected) {
			// Nothing selected, check one value
			column.setFilterValue([value]);
		} else {
			const current = [...filterValue];
			const idx = current.indexOf(value);
			if (idx >= 0) {
				current.splice(idx, 1);
			} else {
				current.push(value);
			}
			if (current.length >= allValues.length) {
				column.setFilterValue(undefined);
			} else if (current.length === 0) {
				column.setFilterValue([NONE_SELECTED]);
			} else {
				column.setFilterValue(current);
			}
		}
	}

	function toggleSelectAll() {
		if (allSelected) {
			// Select all → none
			column.setFilterValue([NONE_SELECTED]);
		} else {
			// Any other state → select all
			column.setFilterValue(undefined);
		}
	}

	function isChecked(value: unknown): boolean {
		if (allSelected) return true;
		if (noneSelected) return false;
		return filterValue.includes(value);
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				class="filter-trigger"
				class:active={isFiltered}
				aria-label="Filter {typeof column.columnDef.header === 'string' ? column.columnDef.header : 'column'}"
			>
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
				</svg>
				{#if isFiltered}
					<span class="filter-dot"></span>
				{/if}
			</button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="filter-popover" sideOffset={4} align="start">
		<div class="filter-search">
			<input
				type="text"
				placeholder="Search..."
				bind:value={search}
				class="filter-search-input"
			/>
		</div>
		<div class="filter-header">
			<label class="filter-row">
				<input
					type="checkbox"
					checked={allSelected}
					indeterminate={someSelected}
					onchange={toggleSelectAll}
				/>
				<span class="filter-value">Value</span>
				<span class="filter-count">Count</span>
			</label>
		</div>
		<div class="filter-list">
			{#each filteredEntries as entry}
				<label class="filter-row">
					<input
						type="checkbox"
						checked={isChecked(entry.value)}
						onchange={() => toggleValue(entry.value)}
					/>
					<span class="filter-value">{entry.label}</span>
					<span class="filter-count">{entry.count}</span>
				</label>
			{/each}
			{#if filteredEntries.length === 0}
				<div class="filter-empty">No values found</div>
			{/if}
		</div>
	</Popover.Content>
</Popover.Root>

<style>
	.filter-trigger {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.15rem;
		color: var(--color-muted);
		display: inline-flex;
		align-items: center;
		position: relative;
		border-radius: var(--radius-sm);
		vertical-align: middle;
		margin-left: 0.25rem;
	}

	.filter-trigger:hover {
		color: var(--color-foreground);
		background: var(--color-hover);
	}

	.filter-trigger.active {
		color: var(--color-primary);
	}

	.filter-dot {
		position: absolute;
		top: -1px;
		right: -1px;
		width: 6px;
		height: 6px;
		background: var(--color-primary);
		border-radius: 50%;
	}

	:global(.filter-popover) {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		min-width: 200px;
		max-width: 320px;
		width: max-content;
		z-index: var(--z-dropdown);
		display: flex;
		flex-direction: column;
	}

	.filter-search {
		padding: 0.5rem;
	}

	.filter-search-input {
		width: 100%;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-input-bg);
		padding: 0.35rem 0.5rem;
		font-size: 0.8rem;
		color: var(--color-foreground);
		outline: none;
	}

	.filter-search-input:focus {
		border-color: var(--color-primary);
	}

	.filter-search-input::placeholder {
		color: var(--color-muted);
	}

	/* ─── Header row (select-all + Value/Count labels) ────────── */

	.filter-header {
		border-bottom: 1px solid var(--color-border);
	}

	.filter-header .filter-row {
		font-weight: 600;
		color: var(--color-muted);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	/* ─── Rows ────────────────────────────────────────────────── */

	.filter-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.6rem;
		cursor: pointer;
		font-size: 0.8rem;
		color: var(--color-foreground);
	}

	.filter-row:hover {
		background: var(--color-hover);
	}

	.filter-row input[type='checkbox'] {
		accent-color: var(--color-primary);
		width: 0.9rem;
		height: 0.9rem;
		flex-shrink: 0;
	}

	.filter-value {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.filter-count {
		color: var(--color-muted);
		font-size: 0.8rem;
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
		text-align: right;
		min-width: 1.5rem;
	}

	.filter-list {
		max-height: 220px;
		overflow-y: auto;
	}

	.filter-empty {
		padding: 0.6rem;
		font-size: 0.8rem;
		color: var(--color-muted);
		text-align: center;
	}
</style>
