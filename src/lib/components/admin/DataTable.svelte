<script lang="ts" generics="TData">
	import type { Snippet } from 'svelte';
	import type { Table } from '@tanstack/table-core';
	import { FlexRender } from './data-table';
	import TableWrapper from './Table.svelte';

	let {
		table,
		onrowclick,
		pageSize = 0,
		toolbar,
	}: {
		table: Table<TData>;
		onrowclick?: (row: TData) => void;
		pageSize?: number;
		toolbar?: Snippet;
	} = $props();

	// Client-side pagination managed by the component, not TanStack.
	// This avoids the reactivity gap where TanStack's internal state
	// changes aren't visible to Svelte when table is passed as a prop.
	let pageIndex = $state(0);
	let allRows = $derived(table.getRowModel().rows);
	let totalRows = $derived(allRows.length);
	let pageCount = $derived(pageSize > 0 ? Math.ceil(totalRows / pageSize) : 1);
	let paginated = $derived(pageCount > 1);
	let visibleRows = $derived(
		pageSize > 0
			? allRows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
			: allRows
	);

	// Reset to page 0 when data changes
	$effect(() => {
		totalRows;
		pageIndex = 0;
	});
</script>

<TableWrapper {toolbar}>
	<thead>
		{#each table.getHeaderGroups() as headerGroup}
			<tr>
				{#each headerGroup.headers as header}
					<th
						class:sortable={header.column.getCanSort()}
						onclick={header.column.getToggleSortingHandler()}
					>
						{#if !header.isPlaceholder}
							<FlexRender
								content={header.column.columnDef.header!}
								context={header.getContext()}
							/>
							{#if header.column.getIsSorted() === 'asc'}
								<span class="sort-indicator"> ↑</span>
							{:else if header.column.getIsSorted() === 'desc'}
								<span class="sort-indicator"> ↓</span>
							{/if}
						{/if}
					</th>
				{/each}
			</tr>
		{/each}
	</thead>
	<tbody>
		{#each visibleRows as row}
			<tr
				class:clickable={!!onrowclick}
				onclick={() => onrowclick?.(row.original)}
			>
				{#each row.getVisibleCells() as cell}
					<td>
						<FlexRender
							content={cell.column.columnDef.cell!}
							context={cell.getContext()}
						/>
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</TableWrapper>

{#if paginated}
	<nav class="pagination">
		<button
			class="pagination-btn"
			disabled={pageIndex === 0}
			onclick={() => pageIndex--}
		>
			← Prev
		</button>
		<span class="pagination-info">
			{pageIndex + 1} / {pageCount}
		</span>
		<button
			class="pagination-btn"
			disabled={pageIndex >= pageCount - 1}
			onclick={() => pageIndex++}
		>
			Next →
		</button>
	</nav>
{/if}

<style>
	th.sortable {
		cursor: pointer;
		user-select: none;
	}

	th.sortable:hover {
		color: var(--color-foreground);
	}

	.sort-indicator {
		font-size: 0.75rem;
	}

	tr.clickable {
		cursor: pointer;
	}

	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 0.75rem;
		font-size: 0.85rem;
	}

	.pagination-btn {
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 0.3rem 0.6rem;
		cursor: pointer;
		color: var(--color-primary);
		font-size: 0.8rem;
	}

	.pagination-btn:hover:not(:disabled) {
		background: var(--color-hover);
	}

	.pagination-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		color: var(--color-muted);
	}

	.pagination-info {
		color: var(--color-muted);
		font-size: 0.8rem;
	}
</style>
