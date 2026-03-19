<script lang="ts">
	import { Badge, Button, ConfirmDialog, EmptyState, FormField, Input, Select, DataTable, DialogShell } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet, multiSelectFilter, createSelectColumn } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getFacetedRowModel, getFacetedUniqueValues, type SortingState, type RowSelectionState, type ColumnFiltersState } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';
	import { toastError } from '$lib/utils/toast-error';
	import { listLists, createList, updateList, deleteList, sendOptinCampaign } from '../lists.remote';
	import { getSession } from '../../session.remote';
	import { can } from '../../can';

	let [session, listsData] = $derived(await Promise.all([getSession(), listLists()]));
	let globalFilter = $state('');
	let columnFilters = $state<ColumnFiltersState>([]);

	// Row selection
	let rowSelection = $state<RowSelectionState>({});
	let selectedRows = $derived.by(() => {
		if (!listsData) return [];
		return Object.keys(rowSelection)
			.filter((k) => rowSelection[k])
			.map((k) => listsData.lists[Number(k)])
			.filter(Boolean);
	});
	let selectedCount = $derived(selectedRows.length);

	function clearSelection() {
		rowSelection = {};
	}

	// Create dialog
	let createOpen = $state(false);
	let createPending = $state(false);
	let createName = $state('');
	let createType = $state<'public' | 'private'>('public');
	let createOptin = $state<'single' | 'double'>('single');
	let createDescription = $state('');

	// Edit dialog
	let editOpen = $state(false);
	let editPending = $state(false);
	let editId = $state(0);
	let editName = $state('');
	let editType = $state<'public' | 'private'>('public');
	let editOptin = $state<'single' | 'double'>('single');
	let editDescription = $state('');

	let confirmDelete = $state(false);

	function openCreate() {
		createName = '';
		createType = 'public';
		createOptin = 'single';
		createDescription = '';
		createOpen = true;
	}

	async function handleCreate() {
		createPending = true;
		try {
			await createList({
				name: createName,
				type: createType,
				optin: createOptin,
				description: createDescription || undefined,
			});
			createOpen = false;
			toast.success('List created.');
			listLists().refresh();
		} catch (err) {
			toastError(err, 'Failed to create list.');
		} finally {
			createPending = false;
		}
	}

	function openEdit(list: ListItem) {
		editId = list.id;
		editName = list.name;
		editType = list.type;
		editOptin = list.optin;
		editDescription = list.description;
		editOpen = true;
	}

	async function handleEdit() {
		editPending = true;
		try {
			await updateList({
				id: editId,
				name: editName,
				type: editType,
				optin: editOptin,
				description: editDescription,
			});
			editOpen = false;
			toast.success('List updated.');
			clearSelection();
			listLists().refresh();
		} catch (err) {
			toastError(err, 'Failed to update list.');
		} finally {
			editPending = false;
		}
	}

	async function handleDelete() {
		try {
			for (const list of selectedRows) {
				await deleteList(list.id);
			}
			toast.success(`${selectedCount} list${selectedCount > 1 ? 's' : ''} deleted.`);
			clearSelection();
			listLists().refresh();
		} catch (err) {
			toastError(err, 'Failed to delete list.');
		}
	}

	let confirmOptin = $state<{ open: boolean; listId: number; listName: string }>({ open: false, listId: 0, listName: '' });
	let optinPending = $state(false);

	async function handleSendOptin() {
		optinPending = true;
		try {
			const result = await sendOptinCampaign(confirmOptin.listId);
			toast.success(`Opt-in confirmations sent to ${result.sent} of ${result.total} subscribers.`);
			confirmOptin = { open: false, listId: 0, listName: '' };
		} catch (err) {
			toastError(err, 'Failed to send opt-in campaign.');
		} finally {
			optinPending = false;
		}
	}

	type ListItem = {
		id: number;
		name: string;
		type: 'public' | 'private';
		optin: 'single' | 'double';
		description: string;
		subscriber_count: number;
		subscriber_statuses: Record<string, number>;
		created_at: string;
		updated_at: string;
	};

	const columnHelper = createColumnHelper<ListItem>();
	let sorting = $state<SortingState>([]);

	const columns = [
		createSelectColumn<ListItem>(),
		columnHelper.accessor('name', {
			header: 'Name',
			cell: (info) => renderSnippet(nameCell, info.row.original),
			enableColumnFilter: false,
		}),
		columnHelper.accessor('type', {
			header: 'Type',
			cell: (info) => renderSnippet(typeCell, info.getValue()),
			enableColumnFilter: true,
			filterFn: multiSelectFilter,
		}),
		columnHelper.accessor('optin', {
			header: 'Opt-in',
			cell: (info) => renderSnippet(optinCell, info.getValue()),
			enableColumnFilter: true,
			filterFn: multiSelectFilter,
		}),
		columnHelper.accessor('subscriber_count', {
			header: 'Subscribers',
			cell: (info) => renderSnippet(subscriberCell, info.row.original),
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

{#snippet nameCell(list: ListItem)}
	<button class="cell-link" onclick={() => openEdit(list)}>{list.name}</button>
{/snippet}

{#snippet typeCell(type: string)}
	<Badge variant={type === 'public' ? 'info' : 'default'}>{type}</Badge>
{/snippet}

{#snippet optinCell(optin: string)}
	<Badge variant={optin === 'double' ? 'warning' : 'success'}>{optin}</Badge>
{/snippet}

{#snippet subscriberCell(list: ListItem)}
	{@const unconfirmed = list.subscriber_statuses?.unconfirmed ?? 0}
	<span class="count">{list.subscriber_count}</span>
	{#if unconfirmed > 0}
		<span class="unconfirmed">
			{unconfirmed} unconfirmed
			{#if list.optin === 'double' && can(session, 'list', 'edit')}
				<button class="optin-btn" onclick={() => (confirmOptin = { open: true, listId: list.id, listName: list.name })}>
					Send opt-in
				</button>
			{/if}
		</span>
	{/if}
{/snippet}

{#snippet dateCell(date: string)}
	<span class="cell-date">{new Date(date).toLocaleDateString()}</span>
{/snippet}

<h1>Mailing Lists</h1>

{#if listsData}
	{#snippet toolbar()}
		{#if selectedCount > 0 && can(session, 'list', 'delete')}
			<span class="toolbar-count">{selectedCount} selected</span>
			<div class="toolbar-actions">
				<Button variant="danger-outline" onclick={() => (confirmDelete = true)}>Delete</Button>
				<button class="toolbar-clear" onclick={clearSelection}>Clear</button>
			</div>
		{:else}
			<div class="toolbar-search">
				<Input type="text" placeholder="Filter lists..." bind:value={globalFilter} />
			</div>
			{#if can(session, 'list', 'create')}
				<Button variant="primary" onclick={openCreate}>+ New List</Button>
			{/if}
		{/if}
	{/snippet}

	{@const table = createSvelteTable({
		data: listsData.lists,
		columns,
		state: { sorting, rowSelection, globalFilter, columnFilters },
		onSortingChange: (updater) => {
			sorting = typeof updater === 'function' ? updater(sorting) : updater;
		},
		onRowSelectionChange: (updater) => {
			rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
		},
		onGlobalFilterChange: (updater) => {
			globalFilter = typeof updater === 'function' ? updater(globalFilter) : updater;
		},
		onColumnFiltersChange: (updater) => {
			columnFilters = typeof updater === 'function' ? updater(columnFilters) : updater;
		},
		enableColumnFilters: true,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
	})}
	<DataTable {table} {toolbar} />
	{#if listsData.lists.length === 0}
		<EmptyState message="No mailing lists found." />
	{/if}
{/if}

<ConfirmDialog
	bind:open={confirmDelete}
	title="Delete List{selectedCount > 1 ? 's' : ''}"
	description="Permanently delete {selectedCount} list{selectedCount > 1 ? 's' : ''}? Subscribers will not be deleted."
	confirmLabel="Yes, delete"
	onconfirm={handleDelete}
/>

<ConfirmDialog
	bind:open={confirmOptin.open}
	title="Send Opt-in Campaign"
	description="Send opt-in confirmation emails to all unconfirmed subscribers on &quot;{confirmOptin.listName}&quot;?"
	confirmLabel="Yes, send"
	variant="primary"
	onconfirm={handleSendOptin}
/>

<!-- Create List Dialog -->
<DialogShell bind:open={createOpen} title="New List">
	<div class="form-fields">
		<FormField label="Name" required>
			<Input bind:value={createName} required placeholder="Newsletter" />
		</FormField>

		<div class="form-row">
			<FormField label="Type" hint="Public lists are open to the world to subscribe and may appear on public pages.">
				<Select bind:value={createType} options={[{ value: 'public', label: 'Public' }, { value: 'private', label: 'Private' }]} />
			</FormField>

			<FormField label="Opt-in" hint="Double opt-in sends a confirmation email. Campaigns are only sent to confirmed subscribers.">
				<Select bind:value={createOptin} options={[{ value: 'single', label: 'Single' }, { value: 'double', label: 'Double' }]} />
			</FormField>
		</div>

		<FormField label="Description">
			<textarea class="textarea" bind:value={createDescription} rows="3" placeholder="Optional description..."></textarea>
		</FormField>

		<div class="dialog-actions">
			<Button variant="ghost" onclick={() => (createOpen = false)}>Cancel</Button>
			<Button variant="primary" onclick={handleCreate} disabled={createPending}>
				{createPending ? 'Creating...' : 'Create'}
			</Button>
		</div>
	</div>
</DialogShell>

<!-- Edit List Dialog -->
<DialogShell bind:open={editOpen} title="Edit List">
	<div class="form-fields">
		<FormField label="Name" required>
			<Input bind:value={editName} required />
		</FormField>

		<div class="form-row">
			<FormField label="Type" hint="Public lists are open to the world to subscribe and may appear on public pages.">
				<Select bind:value={editType} options={[{ value: 'public', label: 'Public' }, { value: 'private', label: 'Private' }]} />
			</FormField>

			<FormField label="Opt-in" hint="Double opt-in sends a confirmation email. Campaigns are only sent to confirmed subscribers.">
				<Select bind:value={editOptin} options={[{ value: 'single', label: 'Single' }, { value: 'double', label: 'Double' }]} />
			</FormField>
		</div>

		<FormField label="Description">
			<textarea class="textarea" bind:value={editDescription} rows="3"></textarea>
		</FormField>

		<div class="dialog-actions">
			<Button variant="ghost" onclick={() => (editOpen = false)}>Cancel</Button>
			<Button variant="primary" onclick={handleEdit} disabled={editPending}>
				{editPending ? 'Saving...' : 'Save'}
			</Button>
		</div>
	</div>
</DialogShell>

<style>

	.count {
		font-weight: 600;
		color: var(--brand-amber-dark);
	}

	.unconfirmed {
		display: block;
		font-size: 0.75rem;
		color: var(--color-muted);
	}

	.optin-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-primary);
		font-size: 0.75rem;
		padding: 0;
		margin-left: 0.25rem;
	}

	.optin-btn:hover {
		text-decoration: underline;
	}


</style>
