<script lang="ts">
	import { Badge, Button, ConfirmDialog, EmptyState, Input, DataTable } from '$lib/components/admin';
	import SubscriberEditor from './components/SubscriberEditor.svelte';
	import { createSvelteTable, renderSnippet, multiSelectFilter, createSelectColumn } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel, getFilteredRowModel, getFacetedRowModel, getFacetedUniqueValues, type RowSelectionState, type ColumnFiltersState } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';
	import { toastError } from '$lib/utils/toast-error';
	import { listSubscribers, deleteSubscribers, blocklistSubscribers } from '../subscribers.remote';
	import { subscriberStatusVariant } from '$lib/utils/admin';
	import type { ListmonkSubscriber } from '$lib/server/listmonk';
	import { listLists } from '../lists.remote';
	import { getSession } from '../../session.remote';
	import { can } from '../../can';

	let [session, data, listsData] = $derived(await Promise.all([getSession(), listSubscribers(), listLists()]));

	let globalFilter = $state('');
	let columnFilters = $state<ColumnFiltersState>([]);

	// Row selection
	let rowSelection = $state<RowSelectionState>({});
	let selectedRows = $derived.by(() => {
		if (!data) return [];
		return Object.keys(rowSelection)
			.filter((k) => rowSelection[k])
			.map((k) => data.subscribers[Number(k)])
			.filter(Boolean);
	});
	let selectedCount = $derived(selectedRows.length);

	function clearSelection() {
		rowSelection = {};
	}

	// Subscriber editor (create + edit)
	let editorOpen = $state(false);
	let editorSubscriber = $state<ListmonkSubscriber | null>(null);

	// Confirm dialogs
	let confirmDelete = $state(false);
	let confirmBlocklist = $state(false);

	function openCreate() {
		editorSubscriber = null;
		editorOpen = true;
	}

	function openEdit(sub: ListmonkSubscriber) {
		editorSubscriber = sub;
		editorOpen = true;
	}

	function handleEditorSaved() {
		clearSelection();
		refreshList();
	}

	async function handleDelete() {
		try {
			await deleteSubscribers(selectedRows.map((sub) => sub.id));
			toast.success(`${selectedCount} subscriber${selectedCount > 1 ? 's' : ''} deleted.`);
			clearSelection();
			refreshList();
		} catch (err) {
			toastError(err, 'Failed to delete subscriber.');
		}
	}

	async function handleBlocklist() {
		try {
			await blocklistSubscribers(selectedRows.map((sub) => sub.id));
			toast.success(`${selectedCount} subscriber${selectedCount > 1 ? 's' : ''} blocklisted.`);
			clearSelection();
			refreshList();
		} catch (err) {
			toastError(err, 'Failed to blocklist subscriber.');
		}
	}

	function refreshList() {
		listSubscribers().refresh();
	}

	let canBlocklist = $derived(
		can(session, 'subscriber', 'blocklist') && selectedRows.some((s) => s.status !== 'blocklisted'),
	);

	const columnHelper = createColumnHelper<ListmonkSubscriber>();

	const columns = [
		createSelectColumn<ListmonkSubscriber>(),
		columnHelper.accessor('email', {
			header: 'Email',
			cell: (info) => renderSnippet(emailCell, info.row.original),
			enableColumnFilter: false,
		}),
		columnHelper.accessor('name', {
			header: 'Name',
			cell: (info) => info.getValue() || '—',
			enableColumnFilter: false,
		}),
		columnHelper.accessor('status', {
			header: 'Status',
			cell: (info) => renderSnippet(statusCell, info.getValue()),
			enableColumnFilter: true,
			filterFn: multiSelectFilter,
		}),
		columnHelper.accessor(
			(row) => row.lists.map((l) => l.subscription_status === 'unconfirmed' ? `${l.name} (unconfirmed)` : l.name),
			{
				id: 'lists',
				header: 'Lists',
				cell: (info) => renderSnippet(listsCell, info.row.original.lists),
				enableSorting: false,
				enableColumnFilter: true,
				filterFn: (row, columnId, filterValue: unknown[]) => {
					if (!filterValue || filterValue.length === 0) return true;
					const values: string[] = row.getValue(columnId);
					return values.some((v) => filterValue.includes(v));
				},
				getUniqueValues: (row) =>
					row.lists.map((l) => l.subscription_status === 'unconfirmed' ? `${l.name} (unconfirmed)` : l.name),
			},
		),
		columnHelper.accessor('created_at', {
			header: 'Created',
			cell: (info) => renderSnippet(dateCell, info.getValue()),
			enableColumnFilter: false,
		}),
		columnHelper.accessor('updated_at', {
			header: 'Updated',
			cell: (info) => renderSnippet(dateCell, info.getValue()),
			enableColumnFilter: false,
		}),
	];
</script>

{#snippet emailCell(sub: ListmonkSubscriber)}
	<button class="cell-link" onclick={() => openEdit(sub)}>{sub.email}</button>
{/snippet}

{#snippet statusCell(status: string)}
	<Badge variant={subscriberStatusVariant(status)}>{status}</Badge>
{/snippet}

{#snippet listsCell(lists: { id: number; name: string; subscription_status: string }[])}
	<div class="cell-badges">
		{#each lists as list}
			<Badge variant={list.subscription_status === 'unconfirmed' ? 'warning' : 'default'}>
				{list.name}{#if list.subscription_status === 'unconfirmed'} (unconfirmed){/if}
			</Badge>
		{/each}
		{#if lists.length === 0}
			<span class="cell-muted">—</span>
		{/if}
	</div>
{/snippet}

{#snippet dateCell(date: string)}
	<span class="cell-date">{new Date(date).toLocaleDateString()}</span>
{/snippet}

<h1>Subscribers</h1>

{#if data}
	{#snippet toolbar()}
		{#if selectedCount > 0 && can(session, 'subscriber', 'delete')}
			<span class="toolbar-count">{selectedCount} selected</span>
			<div class="toolbar-actions">
				{#if canBlocklist}
					<Button variant="danger-outline" onclick={() => (confirmBlocklist = true)}>Blocklist</Button>
				{/if}
				<Button variant="danger-outline" onclick={() => (confirmDelete = true)}>Delete</Button>
				<button class="toolbar-clear" onclick={clearSelection}>Clear</button>
			</div>
		{:else}
			<div class="toolbar-search">
				<Input type="text" placeholder="Filter by email or name..." bind:value={globalFilter} />
			</div>
			{#if can(session, 'subscriber', 'create')}
				<Button variant="primary" onclick={openCreate}>+ New Subscriber</Button>
			{/if}
		{/if}
	{/snippet}

	{@const table = createSvelteTable({
		data: data.subscribers,
		columns,
		state: { rowSelection, columnFilters, globalFilter },
		onRowSelectionChange: (updater) => {
			rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
		},
		onColumnFiltersChange: (updater) => {
			columnFilters = typeof updater === 'function' ? updater(columnFilters) : updater;
		},
		onGlobalFilterChange: (updater) => {
			globalFilter = typeof updater === 'function' ? updater(globalFilter) : updater;
		},
		enableColumnFilters: true,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
	})}
	<DataTable {table} {toolbar} pageSize={20} />
	{#if data.subscribers.length === 0}
		<EmptyState message="No subscribers found." />
	{/if}
{/if}

<ConfirmDialog
	bind:open={confirmDelete}
	title="Delete Subscriber{selectedCount > 1 ? 's' : ''}"
	description="Permanently delete {selectedCount} subscriber{selectedCount > 1 ? 's' : ''}? This cannot be undone."
	confirmLabel="Yes, delete"
	onconfirm={handleDelete}
/>

<ConfirmDialog
	bind:open={confirmBlocklist}
	title="Blocklist Subscriber{selectedCount > 1 ? 's' : ''}"
	description="Blocklist {selectedCount} subscriber{selectedCount > 1 ? 's' : ''}? They will no longer receive any emails."
	confirmLabel="Yes, blocklist"
	onconfirm={handleBlocklist}
/>

<SubscriberEditor
	bind:open={editorOpen}
	subscriber={editorSubscriber}
	allLists={listsData?.lists ?? []}
	canEdit={can(session, 'subscriber', 'edit')}
	onSaved={handleEditorSaved}
/>
