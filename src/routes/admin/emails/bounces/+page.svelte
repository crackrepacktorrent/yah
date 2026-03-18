<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Badge, Button, ConfirmDialog, EmptyState, PaginationNav, Spinner, DataTable } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel, type RowSelectionState } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';
	import { listBounces, deleteBounce, deleteAllBounces } from '../bounces.remote';
	import { getSession } from '../../session.remote';

	let role = $derived(getSession().current?.role);
	let currentPage = $derived(Number($page.url.searchParams.get('page')) || 1);

	let bouncesQuery = $derived(listBounces({ page: currentPage, perPage: 20 }));
	let _prev: typeof bouncesQuery.current;
	let data = $derived.by(() => {
		const val = bouncesQuery.current;
		if (val !== undefined) _prev = val;
		return val ?? _prev;
	});

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

	function pageUrl(p: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(p));
		return `/admin/emails/bounces?${params.toString()}`;
	}

	function bounceTypeVariant(type: string): 'error' | 'warning' | 'default' {
		if (type === 'hard') return 'error';
		if (type === 'soft') return 'warning';
		return 'default';
	}

	async function handleDeleteSelected() {
		try {
			for (const bounce of selectedRows) {
				await deleteBounce(bounce.id);
			}
			toast.success(`${selectedCount} bounce${selectedCount > 1 ? 's' : ''} deleted.`);
			clearSelection();
			refreshList();
		} catch (err: any) {
			toast.error(err?.message || 'Failed to delete bounce.');
		}
	}

	async function handleClearAll() {
		try {
			await deleteAllBounces();
			toast.success('All bounces cleared.');
			clearSelection();
			refreshList();
		} catch (err: any) {
			toast.error(err?.message || 'Failed to clear bounces.');
		}
	}

	function refreshList() {
		listBounces({ page: currentPage, perPage: 20 }).refresh();
	}

	type Bounce = {
		id: number;
		email: string;
		type: string;
		source: string;
		created_at: string;
	};

	const columnHelper = createColumnHelper<Bounce>();

	const columns = [
		columnHelper.display({
			id: 'select',
			header: (info) => renderSnippet(selectAllCell, info.table),
			cell: (info) => renderSnippet(selectRowCell, info.row),
			enableSorting: false,
		}),
		columnHelper.accessor('email', {
			header: 'Email',
			cell: (info) => info.getValue(),
		}),
		columnHelper.accessor('type', {
			header: 'Type',
			cell: (info) => renderSnippet(typeCell, info.getValue()),
		}),
		columnHelper.accessor('source', {
			header: 'Source',
			cell: (info) => info.getValue() || '—',
		}),
		columnHelper.accessor('created_at', {
			header: 'Date',
			cell: (info) => renderSnippet(dateCell, info.getValue()),
		}),
	];
</script>

{#snippet selectAllCell(table: any)}
	<input type="checkbox" class="row-checkbox" checked={table.getIsAllRowsSelected()} indeterminate={table.getIsSomeRowsSelected()} onchange={table.getToggleAllRowsSelectedHandler()} />
{/snippet}

{#snippet selectRowCell(row: any)}
	<input type="checkbox" class="row-checkbox" checked={row.getIsSelected()} onchange={row.getToggleSelectedHandler()} />
{/snippet}

{#snippet typeCell(type: string)}
	<Badge variant={bounceTypeVariant(type)}>{type}</Badge>
{/snippet}

{#snippet dateCell(date: string)}
	<span class="date">{new Date(date).toLocaleDateString()}</span>
{/snippet}

<h1>Bounces</h1>

{#if !data && bouncesQuery.loading}
	<Spinner size={48} centered />
{:else if data}
	{#if data.bounces.length === 0}
		<EmptyState message="No bounces recorded." />
	{:else}
		{#snippet toolbar()}
			{#if selectedCount > 0 && role === 'owner'}
				<span class="toolbar-count">{selectedCount} selected</span>
				<div class="toolbar-actions">
					<Button variant="danger-outline" onclick={() => (confirmDelete = true)}>Delete</Button>
					<button class="toolbar-clear" onclick={clearSelection}>Clear</button>
				</div>
			{:else}
				<div class="toolbar-spacer"></div>
				{#if role === 'owner'}
					<Button variant="danger" onclick={() => (confirmClearAll = true)}>Clear All</Button>
				{/if}
			{/if}
		{/snippet}

		{@const table = createSvelteTable({
			data: data.bounces,
			columns,
			state: { rowSelection },
			onRowSelectionChange: (updater) => {
				rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
			},
			getCoreRowModel: getCoreRowModel(),
			manualPagination: true,
		})}
		<DataTable {table} {toolbar} />

		{#if data.total > data.perPage}
			<PaginationNav
				count={data.total}
				perPage={data.perPage}
				page={data.page}
				onPageChange={(p) => goto(pageUrl(p))}
			/>
		{/if}
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

<style>
	h1 {
		margin: 0 0 1.5rem;
		color: var(--color-foreground);
	}

	.date {
		color: var(--color-muted);
		white-space: nowrap;
	}

	:global(.row-checkbox) {
		width: 1rem;
		height: 1rem;
		accent-color: var(--color-primary);
		cursor: pointer;
	}
</style>
