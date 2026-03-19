<script lang="ts">
	import { Badge, Button, ConfirmDialog, EmptyState, FormField, Input, Select, DataTable, DialogShell } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet, multiSelectFilter, createSelectColumn } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel, getFilteredRowModel, getFacetedRowModel, getFacetedUniqueValues, type RowSelectionState, type ColumnFiltersState } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';
	import { toastError } from '$lib/utils/toast-error';
	import { listSubscribers, createSubscriber, updateSubscriber, deleteSubscriber, blocklistSubscriber } from '../subscribers.remote';
	import { listLists } from '../lists.remote';
	import { getSession } from '../../session.remote';
	import { can } from '../../can';

	// Test: Promise.all for parallel fetching
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

	// Create dialog
	let createOpen = $state(false);
	let createPending = $state(false);
	let createEmail = $state('');
	let createName = $state('');
	let createStatus = $state('enabled');
	let createListIds = $state<number[]>([]);

	// Edit dialog
	let editOpen = $state(false);
	let editPending = $state(false);
	let editId = $state(0);
	let editEmail = $state('');
	let editName = $state('');
	let editStatus = $state('enabled');
	let editListIds = $state<number[]>([]);

	// Confirm dialogs
	let confirmDelete = $state(false);
	let confirmBlocklist = $state(false);

	function openCreate() {
		createEmail = '';
		createName = '';
		createStatus = 'enabled';
		createListIds = [];
		createOpen = true;
	}

	async function handleCreate() {
		createPending = true;
		try {
			await createSubscriber({
				email: createEmail,
				name: createName || undefined,
				status: createStatus,
				listIds: createListIds.length ? createListIds : undefined,
			});
			createOpen = false;
			toast.success('Subscriber created.');
			refreshList();
		} catch (err) {
			toastError(err, 'Failed to create subscriber.');
		} finally {
			createPending = false;
		}
	}

	function openEdit(sub: Subscriber) {
		editId = sub.id;
		editEmail = sub.email;
		editName = sub.name;
		editStatus = sub.status;
		editListIds = sub.lists.map((l) => l.id);
		editOpen = true;
	}

	async function handleEdit() {
		editPending = true;
		try {
			await updateSubscriber({
				id: editId,
				email: editEmail,
				name: editName,
				status: editStatus,
				listIds: editListIds,
			});
			editOpen = false;
			toast.success('Subscriber updated.');
			clearSelection();
			refreshList();
		} catch (err) {
			toastError(err, 'Failed to update subscriber.');
		} finally {
			editPending = false;
		}
	}

	async function handleDelete() {
		try {
			for (const sub of selectedRows) {
				await deleteSubscriber(sub.id);
			}
			toast.success(`${selectedCount} subscriber${selectedCount > 1 ? 's' : ''} deleted.`);
			clearSelection();
			refreshList();
		} catch (err) {
			toastError(err, 'Failed to delete subscriber.');
		}
	}

	async function handleBlocklist() {
		try {
			for (const sub of selectedRows) {
				await blocklistSubscriber(sub.id);
			}
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

	function statusVariant(status: string): 'success' | 'error' | 'default' {
		if (status === 'enabled') return 'success';
		if (status === 'blocklisted') return 'error';
		return 'default';
	}

	function toggleListId(id: number, list: number[]) {
		return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
	}

	let canBlocklist = $derived(
		can(session, 'subscriber', 'blocklist') && selectedRows.some((s) => s.status !== 'blocklisted'),
	);

	type Subscriber = {
		id: number;
		email: string;
		name: string;
		status: string;
		lists: { id: number; name: string }[];
		created_at: string;
		updated_at: string;
	};

	const columnHelper = createColumnHelper<Subscriber>();

	const columns = [
		createSelectColumn<Subscriber>(),
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
		columnHelper.accessor('lists', {
			header: 'Lists',
			cell: (info) => renderSnippet(listsCell, info.getValue()),
			enableSorting: false,
			enableColumnFilter: false,
		}),
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

{#snippet emailCell(sub: Subscriber)}
	<button class="cell-link" onclick={() => openEdit(sub)}>{sub.email}</button>
{/snippet}

{#snippet statusCell(status: string)}
	<Badge variant={statusVariant(status)}>{status}</Badge>
{/snippet}

{#snippet listsCell(lists: { id: number; name: string }[])}
	<div class="cell-badges">
		{#each lists as list}
			<Badge>{list.name}</Badge>
		{/each}
		{#if lists.length === 0}
			<span class="cell-muted">—</span>
		{/if}
	</div>
{/snippet}

{#snippet dateCell(date: string)}
	<span class="cell-date">{new Date(date).toLocaleDateString()}</span>
{/snippet}

{#snippet listCheckboxes(selectedIds: number[], onToggle: (id: number) => void)}
	{@const allLists = listsData?.lists ?? []}
	<div class="list-checkboxes">
		{#each allLists as list}
			<label class="list-checkbox">
				<input
					type="checkbox"
					checked={selectedIds.includes(list.id)}
					onchange={() => onToggle(list.id)}
				/>
				<span>{list.name}</span>
				<Badge variant={list.type === 'public' ? 'info' : 'default'}>{list.type}</Badge>
			</label>
		{/each}
		{#if allLists.length === 0}
			<span class="cell-muted">No lists available</span>
		{/if}
	</div>
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

<!-- Create Subscriber Dialog -->
<DialogShell bind:open={createOpen} title="New Subscriber">
	<div class="form-fields">
		<FormField label="Email" required>
			<Input type="email" bind:value={createEmail} required placeholder="subscriber@example.com" />
		</FormField>

		<FormField label="Name">
			<Input bind:value={createName} placeholder="Full name" />
		</FormField>

		<FormField label="Status" hint="Blocklisted subscribers will never receive any emails.">
			<Select bind:value={createStatus} options={[{ value: 'enabled', label: 'Enabled' }, { value: 'blocklisted', label: 'Blocklisted' }]} />
		</FormField>

		<FormField label="Lists">
			{@render listCheckboxes(createListIds, (id) => (createListIds = toggleListId(id, createListIds)))}
		</FormField>

		<div class="dialog-actions">
			<button type="button" class="cancel-btn" onclick={() => (createOpen = false)}>Cancel</button>
			<Button variant="primary" onclick={handleCreate} disabled={createPending}>
				{createPending ? 'Creating...' : 'Create'}
			</Button>
		</div>
	</div>
</DialogShell>

<!-- Edit Subscriber Dialog -->
<DialogShell bind:open={editOpen} title="Edit Subscriber">
	<div class="form-fields">
		<FormField label="Email" required>
			<Input type="email" bind:value={editEmail} required />
		</FormField>

		<FormField label="Name">
			<Input bind:value={editName} placeholder="Full name" />
		</FormField>

		<FormField label="Status" hint="Blocklisted subscribers will never receive any emails.">
			<Select bind:value={editStatus} options={[{ value: 'enabled', label: 'Enabled' }, { value: 'blocklisted', label: 'Blocklisted' }]} />
		</FormField>

		<FormField label="Lists">
			{@render listCheckboxes(editListIds, (id) => (editListIds = toggleListId(id, editListIds)))}
		</FormField>

		<div class="dialog-actions">
			<button type="button" class="cancel-btn" onclick={() => (editOpen = false)}>Cancel</button>
			<Button variant="primary" onclick={handleEdit} disabled={editPending}>
				{editPending ? 'Saving...' : 'Save'}
			</Button>
		</div>
	</div>
</DialogShell>

<style>
</style>
