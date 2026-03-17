<script lang="ts" generics="TData">
	import type { Table } from '@tanstack/table-core';
	import { FlexRender } from './data-table';
	import TableWrapper from './Table.svelte';

	let {
		table,
		onrowclick
	}: {
		table: Table<TData>;
		onrowclick?: (row: TData) => void;
	} = $props();
</script>

<TableWrapper>
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
		{#each table.getRowModel().rows as row}
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
</style>
