<script lang="ts">
	import { Badge, Button, ConfirmDialog, EmptyState, DataTable } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet, multiSelectFilter, createSelectColumn } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel, getFilteredRowModel, getFacetedRowModel, getFacetedUniqueValues, type RowSelectionState, type ColumnFiltersState } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';
	import { toastError } from '$lib/utils/toast-error';
	import { listBounces, deleteBounces, deleteAllBounces } from '../bounces.remote';
	import { getSession } from '../../session.remote';
	import { can } from '../../can';

	let [session, data] = $derived(await Promise.all([getSession(), listBounces()]));
	let columnFilters = $state<ColumnFiltersState>([]);

	// Row selection
	let rowSelection = $state<RowSelectionState>({});
	let selectedRows = $derived.by(() => {
		if (!data) return [];
		return Object.keys(rowSelection)
			.filter((k) => rowSelection[k])
			.map((k) => data.bounces[Number(k)])
			.filter(Boolean);
	});
	let selectedCount = $derived(selectedRows.length);

	function clearSelection() {
		rowSelection = {};
	}

	let confirmDelete = $state(false);
	let confirmClearAll = $state(false);

	function bounceTypeVariant(type: string): 'error' | 'warning' | 'info' | 'default' {
		if (type === 'hard') return 'error';
		if (type === 'soft') return 'warning';
		if (type === 'complaint') return 'info';
		return 'default';
	}

	async function handleDeleteSelected() {
		try {
			await deleteBounces(selectedRows.map((bounce) => bounce.id));
			toast.success(`${selectedCount} bounce${selectedCount > 1 ? 's' : ''} deleted.`);
			clearSelection();
			refreshList();
		} catch (err) {
			toastError(err, 'Failed to delete bounce.');
		}
	}

	async function handleClearAll() {
		try {
			await deleteAllBounces();
			toast.success('All bounces cleared.');
			clearSelection();
			refreshList();
		} catch (err) {
			toastError(err, 'Failed to clear bounces.');
		}
	}

	function refreshList() {
		listBounces().refresh();
	}

	type Bounce = {
		id: number;
		email: string;
		campaign_id: number;
		type: string;
		source: string;
		created_at: string;
	};

	const columnHelper = createColumnHelper<Bounce>();

	const columns = [
		createSelectColumn<Bounce>(),
		columnHelper.accessor('email', {
			header: 'Email',
			cell: (info) => info.getValue(),
			enableColumnFilter: false,
		}),
		columnHelper.accessor('campaign_id', {
			header: 'Campaign',
			cell: (info) => info.getValue() || '—',
			enableColumnFilter: false,
		}),
		columnHelper.accessor('type', {
			header: 'Type',
			cell: (info) => renderSnippet(typeCell, info.getValue()),
			enableColumnFilter: true,
			filterFn: multiSelectFilter,
		}),
		columnHelper.accessor('source', {
			header: 'Source',
			cell: (info) => info.getValue() || '—',
			enableColumnFilter: false,
		}),
		columnHelper.accessor('created_at', {
			header: 'Date',
			cell: (info) => renderSnippet(dateCell, info.getValue()),
			enableColumnFilter: false,
		}),
	];
</script>

{#snippet typeCell(type: string)}
	<Badge variant={bounceTypeVariant(type)}>{type}</Badge>
{/snippet}

{#snippet dateCell(date: string)}
	<span class="cell-date">{new Date(date).toLocaleDateString()}</span>
{/snippet}

<h1>Bounces</h1>

{#if data}
	{#snippet toolbar()}
		{#if selectedCount > 0 && can(session, 'bounce', 'delete')}
			<span class="toolbar-count">{selectedCount} selected</span>
			<div class="toolbar-actions">
				<Button variant="danger-outline" onclick={() => (confirmDelete = true)}>Delete</Button>
				<button class="toolbar-clear" onclick={clearSelection}>Clear</button>
			</div>
		{:else}
			<div class="toolbar-spacer"></div>
			{#if can(session, 'bounce', 'clear-all')}
				<Button variant="danger" onclick={() => (confirmClearAll = true)}>Clear All</Button>
			{/if}
		{/if}
	{/snippet}

	{@const table = createSvelteTable({
		data: data.bounces,
		columns,
		state: { rowSelection, columnFilters },
		onRowSelectionChange: (updater) => {
			rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
		},
		onColumnFiltersChange: (updater) => {
			columnFilters = typeof updater === 'function' ? updater(columnFilters) : updater;
		},
		enableColumnFilters: true,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
	})}
	<DataTable {table} {toolbar} pageSize={20} />
	{#if data.bounces.length === 0}
		<EmptyState message="No bounces recorded." />
	{/if}
{/if}

<ConfirmDialog
	bind:open={confirmDelete}
	title="Delete Bounce{selectedCount > 1 ? 's' : ''}"
	description="Delete {selectedCount} bounce record{selectedCount > 1 ? 's' : ''}? This cannot be undone."
	confirmLabel="Yes, delete"
	onconfirm={handleDeleteSelected}
/>

<ConfirmDialog
	bind:open={confirmClearAll}
	title="Clear All Bounces"
	description="Delete all bounce records? This cannot be undone."
	confirmLabel="Yes, clear all"
	onconfirm={handleClearAll}
/>
