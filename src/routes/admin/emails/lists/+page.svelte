<script lang="ts">
	import { Badge, Button, ConfirmDialog, EmptyState, FormField, Input, Spinner, DataTable, DialogShell } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel, getFilteredRowModel, getSortedRowModel, type SortingState, type RowSelectionState } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';
	import { listLists, createList, updateList, deleteList } from '../lists.remote';
	import { getSession } from '../../session.remote';

	let role = $derived(getSession().current?.role);
	let listsQuery = $derived(listLists());
	let _prevLists: typeof listsQuery.current;
	let listsData = $derived.by(() => {
		const val = listsQuery.current;
		if (val !== undefined) _prevLists = val;
		return val ?? _prevLists;
	});
	let globalFilter = $state('');

	// Row selection
	let rowSelection = $state<RowSelectionState>({});
	let selectedRows = $derived.by(() => {
		const data = listsQuery.current;
		if (!data) return [];
		return Object.keys(rowSelection)
			.filter((k) => rowSelection[k])
			.map((k) => data.lists[Number(k)])
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
		} catch (err: any) {
			toast.error(err?.message || 'Failed to create list.');
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
		} catch (err: any) {
			toast.error(err?.message || 'Failed to update list.');
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
		} catch (err: any) {
			toast.error(err?.message || 'Failed to delete list.');
		}
	}

	type ListItem = {
		id: number;
		name: string;
		type: 'public' | 'private';
		optin: 'single' | 'double';
		description: string;
		subscriber_count: number;
		created_at: string;
		updated_at: string;
	};

	const columnHelper = createColumnHelper<ListItem>();
	let sorting = $state<SortingState>([]);

	const columns = [
		columnHelper.display({
			id: 'select',
			header: (info) => renderSnippet(selectAllCell, info.table),
			cell: (info) => renderSnippet(selectRowCell, info.row),
			enableSorting: false,
		}),
		columnHelper.accessor('name', {
			header: 'Name',
			cell: (info) => renderSnippet(nameCell, info.row.original),
		}),
		columnHelper.accessor('type', {
			header: 'Type',
			cell: (info) => renderSnippet(typeCell, info.getValue()),
		}),
		columnHelper.accessor('optin', {
			header: 'Opt-in',
			cell: (info) => renderSnippet(optinCell, info.getValue()),
		}),
		columnHelper.accessor('subscriber_count', {
			header: 'Subscribers',
			cell: (info) => renderSnippet(countCell, info.getValue()),
		}),
		columnHelper.accessor('created_at', {
			header: 'Created',
			cell: (info) => renderSnippet(dateCell, info.getValue()),
		}),
		columnHelper.accessor('updated_at', {
			header: 'Updated',
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

{#snippet nameCell(list: ListItem)}
	<button class="name-link" onclick={() => openEdit(list)}>{list.name}</button>
{/snippet}

{#snippet typeCell(type: string)}
	<Badge variant={type === 'public' ? 'info' : 'default'}>{type}</Badge>
{/snippet}

{#snippet optinCell(optin: string)}
	<Badge variant={optin === 'double' ? 'warning' : 'success'}>{optin}</Badge>
{/snippet}

{#snippet countCell(count: number)}
	<span class="count">{count}</span>
{/snippet}

{#snippet dateCell(date: string)}
	<span class="date">{new Date(date).toLocaleDateString()}</span>
{/snippet}

<h1>Mailing Lists</h1>

{#if !listsData && listsQuery.loading}
	<Spinner size={48} centered />
{:else if listsData}
	{#snippet toolbar()}
		{#if selectedCount > 0 && role === 'owner'}
			<span class="toolbar-count">{selectedCount} selected</span>
			<div class="toolbar-actions">
				<Button variant="danger-outline" onclick={() => (confirmDelete = true)}>Delete</Button>
				<button class="toolbar-clear" onclick={clearSelection}>Clear</button>
			</div>
		{:else}
			<div class="toolbar-search">
				<Input type="text" placeholder="Filter lists..." bind:value={globalFilter} />
			</div>
			{#if role === 'admin' || role === 'owner'}
				<Button variant="primary" onclick={openCreate}>+ New List</Button>
			{/if}
		{/if}
	{/snippet}

	{@const table = createSvelteTable({
		data: listsData.lists,
		columns,
		state: { sorting, rowSelection, globalFilter },
		onSortingChange: (updater) => {
			sorting = typeof updater === 'function' ? updater(sorting) : updater;
		},
		onRowSelectionChange: (updater) => {
			rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
		},
		onGlobalFilterChange: (updater) => {
			globalFilter = typeof updater === 'function' ? updater(globalFilter) : updater;
		},
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
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

<!-- Create List Dialog -->
<DialogShell bind:open={createOpen} title="New List">
	<div class="form-fields">
		<FormField label="Name" required>
			<Input bind:value={createName} required placeholder="Newsletter" />
		</FormField>

		<div class="row">
			<FormField label="Type">
				<select class="select" bind:value={createType}>
					<option value="public">Public</option>
					<option value="private">Private</option>
				</select>
			</FormField>

			<FormField label="Opt-in">
				<select class="select" bind:value={createOptin}>
					<option value="single">Single</option>
					<option value="double">Double</option>
				</select>
			</FormField>
		</div>

		<FormField label="Description">
			<textarea class="textarea" bind:value={createDescription} rows="3" placeholder="Optional description..."></textarea>
		</FormField>

		<div class="actions">
			<button type="button" class="cancel-btn" onclick={() => (createOpen = false)}>Cancel</button>
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

		<div class="row">
			<FormField label="Type">
				<select class="select" bind:value={editType}>
					<option value="public">Public</option>
					<option value="private">Private</option>
				</select>
			</FormField>

			<FormField label="Opt-in">
				<select class="select" bind:value={editOptin}>
					<option value="single">Single</option>
					<option value="double">Double</option>
				</select>
			</FormField>
		</div>

		<FormField label="Description">
			<textarea class="textarea" bind:value={editDescription} rows="3"></textarea>
		</FormField>

		<div class="actions">
			<button type="button" class="cancel-btn" onclick={() => (editOpen = false)}>Cancel</button>
			<Button variant="primary" onclick={handleEdit} disabled={editPending}>
				{editPending ? 'Saving...' : 'Save'}
			</Button>
		</div>
	</div>
</DialogShell>

<style>
	h1 {
		margin: 0 0 1.5rem;
		color: var(--color-foreground);
	}

	.count {
		font-weight: 600;
		color: var(--brand-amber-dark);
	}

	.date {
		color: var(--color-muted);
		white-space: nowrap;
	}

	.name-link {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-primary);
		font-weight: 600;
		font-size: inherit;
		padding: 0;
		text-decoration: none;
	}

	.name-link:hover {
		text-decoration: underline;
	}

	:global(.row-checkbox) {
		width: 1rem;
		height: 1rem;
		accent-color: var(--color-primary);
		cursor: pointer;
	}

	.form-fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.select {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-foreground);
		font-size: 0.9rem;
	}

	.select:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
	}

	.textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-foreground);
		font-size: 0.9rem;
		resize: vertical;
	}

	.textarea:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		justify-content: flex-end;
		margin-top: 0.25rem;
	}

	.cancel-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-muted);
		font-size: 0.9rem;
		padding: 0.4rem 0.75rem;
		border-radius: var(--radius-sm);
	}

	.cancel-btn:hover {
		color: var(--color-foreground);
		background: var(--color-hover);
	}
</style>
