<script lang="ts">
	import { Badge, Button, ConfirmDialog, EmptyState, FormField, Input, Spinner, DataTable } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel, getSortedRowModel, type SortingState, type RowSelectionState } from '@tanstack/table-core';
	import { Dialog } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import { listLists, createList, updateList, deleteList } from '../lists.remote';
	import { getSession } from '../../session.remote';

	let role = $derived(getSession().current?.role);
	let listsQuery = $derived(listLists());

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

<div class="header">
	<h1>Mailing Lists</h1>
	{#if role === 'admin' || role === 'owner'}
		<Button variant="primary" onclick={openCreate}>+ New List</Button>
	{/if}
</div>

{#await listsQuery}
	<Spinner size={48} centered />
{:then data}
	{#if data.lists.length === 0}
		<EmptyState message="No mailing lists found." />
	{:else}
		{@const table = createSvelteTable({
			data: data.lists,
			columns,
			state: { sorting, rowSelection },
			onSortingChange: (updater) => {
				sorting = typeof updater === 'function' ? updater(sorting) : updater;
			},
			onRowSelectionChange: (updater) => {
				rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
			},
			getCoreRowModel: getCoreRowModel(),
			getSortedRowModel: getSortedRowModel(),
		})}

		{#if selectedCount > 0 && role === 'owner'}
			<div class="action-bar">
				<span class="action-bar-count">{selectedCount} selected</span>
				<div class="action-bar-actions">
					<Button variant="danger-outline" onclick={() => (confirmDelete = true)}>Delete</Button>
					<button class="action-bar-clear" onclick={clearSelection}>Clear</button>
				</div>
			</div>
		{/if}

		<DataTable {table} />
	{/if}
{/await}

<ConfirmDialog
	bind:open={confirmDelete}
	title="Delete List{selectedCount > 1 ? 's' : ''}"
	description="Permanently delete {selectedCount} list{selectedCount > 1 ? 's' : ''}? Subscribers will not be deleted."
	confirmLabel="Yes, delete"
	onconfirm={handleDelete}
/>

<!-- Create List Dialog -->
<Dialog.Root bind:open={createOpen}>
	<Dialog.Portal>
		<Dialog.Overlay>
			{#snippet child({ props })}
				<div {...props} class="dialog-overlay"></div>
			{/snippet}
		</Dialog.Overlay>
		<Dialog.Content>
			{#snippet child({ props })}
				<div {...props} class="dialog-content">
					<div class="dialog-header">
						<h2>New List</h2>
						<Dialog.Close>
							{#snippet child({ props: closeProps })}
								<button {...closeProps} class="dialog-close">&times;</button>
							{/snippet}
						</Dialog.Close>
					</div>

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
				</div>
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<!-- Edit List Dialog -->
<Dialog.Root bind:open={editOpen}>
	<Dialog.Portal>
		<Dialog.Overlay>
			{#snippet child({ props })}
				<div {...props} class="dialog-overlay"></div>
			{/snippet}
		</Dialog.Overlay>
		<Dialog.Content>
			{#snippet child({ props })}
				<div {...props} class="dialog-content">
					<div class="dialog-header">
						<h2>Edit List</h2>
						<Dialog.Close>
							{#snippet child({ props: closeProps })}
								<button {...closeProps} class="dialog-close">&times;</button>
							{/snippet}
						</Dialog.Close>
					</div>

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
				</div>
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}

	h1 {
		margin: 0;
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

	.action-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		margin-bottom: 0.5rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.action-bar-count {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-foreground);
		white-space: nowrap;
	}

	.action-bar-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.action-bar-clear {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-muted);
		font-size: 0.8rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
	}

	.action-bar-clear:hover {
		color: var(--color-foreground);
		background: var(--color-hover);
	}

	/* ─── Dialog ───────────────────────────────────────────────────────── */

	.dialog-overlay {
		position: fixed;
		inset: 0;
		background: var(--color-overlay);
		z-index: 50;
	}

	.dialog-content {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 51;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 1.5rem;
		width: 90vw;
		max-width: 520px;
		max-height: 90vh;
		overflow-y: auto;
	}

	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
	}

	.dialog-header h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-foreground);
	}

	.dialog-close {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-muted);
		font-size: 1.5rem;
		line-height: 1;
		padding: 0.25rem;
		border-radius: var(--radius-sm);
	}

	.dialog-close:hover {
		color: var(--color-foreground);
		background: var(--color-hover);
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
