<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Badge, Button, ConfirmDialog, EmptyState, FormField, Input, PaginationNav, Spinner, DataTable } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel, type RowSelectionState } from '@tanstack/table-core';
	import { Dialog } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import { listSubscribers, createSubscriber, updateSubscriber, deleteSubscriber, blocklistSubscriber } from '../subscribers.remote';
	import { listLists } from '../lists.remote';
	import { getSession } from '../../session.remote';

	let role = $derived(getSession().current?.role);

	let search = $state($page.url.searchParams.get('search') || '');
	let currentPage = $derived(Number($page.url.searchParams.get('page')) || 1);

	let subscribersQuery = $derived(listSubscribers({ page: currentPage, perPage: 20, search: search || undefined }));
	let _prev: typeof subscribersQuery.current;
	let data = $derived.by(() => {
		const val = subscribersQuery.current;
		if (val !== undefined) _prev = val;
		return val ?? _prev;
	});

	let listsQuery = $derived(listLists());

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

	function handleSearch(e: Event) {
		e.preventDefault();
		const params = new URLSearchParams($page.url.searchParams);
		if (search) {
			params.set('search', search);
		} else {
			params.delete('search');
		}
		params.delete('page');
		goto(`/admin/emails/subscribers?${params.toString()}`);
	}

	function pageUrl(p: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(p));
		return `/admin/emails/subscribers?${params.toString()}`;
	}

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
		} catch (err: any) {
			toast.error(err?.message || 'Failed to create subscriber.');
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
		} catch (err: any) {
			toast.error(err?.message || 'Failed to update subscriber.');
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
		} catch (err: any) {
			toast.error(err?.message || 'Failed to delete subscriber.');
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
		} catch (err: any) {
			toast.error(err?.message || 'Failed to blocklist subscriber.');
		}
	}

	function refreshList() {
		listSubscribers({ page: currentPage, perPage: 20, search: search || undefined }).refresh();
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
		role === 'owner' && selectedRows.some((s) => s.status !== 'blocklisted'),
	);

	type Subscriber = {
		id: number;
		email: string;
		name: string;
		status: string;
		lists: { id: number; name: string }[];
		created_at: string;
	};

	const columnHelper = createColumnHelper<Subscriber>();

	const columns = [
		columnHelper.display({
			id: 'select',
			header: (info) => renderSnippet(selectAllCell, info.table),
			cell: (info) => renderSnippet(selectRowCell, info.row),
			enableSorting: false,
		}),
		columnHelper.accessor('email', {
			header: 'Email',
			cell: (info) => renderSnippet(emailCell, info.row.original),
		}),
		columnHelper.accessor('name', {
			header: 'Name',
			cell: (info) => info.getValue() || '—',
		}),
		columnHelper.accessor('status', {
			header: 'Status',
			cell: (info) => renderSnippet(statusCell, info.getValue()),
		}),
		columnHelper.accessor('lists', {
			header: 'Lists',
			cell: (info) => renderSnippet(listsCell, info.getValue()),
			enableSorting: false,
		}),
		columnHelper.accessor('created_at', {
			header: 'Created',
			cell: (info) => renderSnippet(dateCell, info.getValue()),
		}),
	];
</script>

{#snippet selectAllCell(table: any)}
	<input
		type="checkbox"
		class="row-checkbox"
		checked={table.getIsAllRowsSelected()}
		indeterminate={table.getIsSomeRowsSelected()}
		onchange={table.getToggleAllRowsSelectedHandler()}
	/>
{/snippet}

{#snippet selectRowCell(row: any)}
	<input
		type="checkbox"
		class="row-checkbox"
		checked={row.getIsSelected()}
		onchange={row.getToggleSelectedHandler()}
	/>
{/snippet}

{#snippet emailCell(sub: Subscriber)}
	<button class="name-link" onclick={() => openEdit(sub)}>{sub.email}</button>
{/snippet}

{#snippet statusCell(status: string)}
	<Badge variant={statusVariant(status)}>{status}</Badge>
{/snippet}

{#snippet listsCell(lists: { id: number; name: string }[])}
	<div class="list-badges">
		{#each lists as list}
			<Badge>{list.name}</Badge>
		{/each}
		{#if lists.length === 0}
			<span class="muted">—</span>
		{/if}
	</div>
{/snippet}

{#snippet dateCell(date: string)}
	<span class="date">{new Date(date).toLocaleDateString()}</span>
{/snippet}

{#snippet listCheckboxes(selectedIds: number[], onToggle: (id: number) => void)}
	{@const allLists = listsQuery.current?.lists ?? []}
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
			<span class="muted">No lists available</span>
		{/if}
	</div>
{/snippet}

<div class="header">
	<h1>Subscribers</h1>
	{#if role === 'admin' || role === 'owner'}
		<Button variant="primary" onclick={openCreate}>+ New Subscriber</Button>
	{/if}
</div>

<form class="search-bar" onsubmit={handleSearch}>
	<Input type="text" placeholder="Search by email or name..." bind:value={search} />
	<Button variant="secondary" type="submit">Search</Button>
</form>

{#if !data && subscribersQuery.loading}
	<Spinner size={48} centered />
{:else if data}
	{#if data.subscribers.length === 0}
		<EmptyState message="No subscribers found." />
	{:else}
		{@const table = createSvelteTable({
			data: data.subscribers,
			columns,
			state: { rowSelection },
			onRowSelectionChange: (updater) => {
				rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
			},
			getCoreRowModel: getCoreRowModel(),
			manualPagination: true,
		})}

		{#if selectedCount > 0 && role === 'owner'}
			<div class="action-bar">
				<span class="action-bar-count">{selectedCount} selected</span>
				<div class="action-bar-actions">
					{#if canBlocklist}
						<Button variant="danger-outline" onclick={() => (confirmBlocklist = true)}>Blocklist</Button>
					{/if}
					<Button variant="danger-outline" onclick={() => (confirmDelete = true)}>Delete</Button>
					<button class="action-bar-clear" onclick={clearSelection}>Clear</button>
				</div>
			</div>
		{/if}

		<DataTable {table} />

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
						<h2>New Subscriber</h2>
						<Dialog.Close>
							{#snippet child({ props: closeProps })}
								<button {...closeProps} class="dialog-close">&times;</button>
							{/snippet}
						</Dialog.Close>
					</div>

					<div class="form-fields">
						<FormField label="Email" required>
							<Input type="email" bind:value={createEmail} required placeholder="subscriber@example.com" />
						</FormField>

						<FormField label="Name">
							<Input bind:value={createName} placeholder="Full name" />
						</FormField>

						<FormField label="Status">
							<select class="select" bind:value={createStatus}>
								<option value="enabled">Enabled</option>
								<option value="disabled">Disabled</option>
								<option value="blocklisted">Blocklisted</option>
							</select>
						</FormField>

						<FormField label="Lists">
							{@render listCheckboxes(createListIds, (id) => (createListIds = toggleListId(id, createListIds)))}
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

<!-- Edit Subscriber Dialog -->
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
						<h2>Edit Subscriber</h2>
						<Dialog.Close>
							{#snippet child({ props: closeProps })}
								<button {...closeProps} class="dialog-close">&times;</button>
							{/snippet}
						</Dialog.Close>
					</div>

					<div class="form-fields">
						<FormField label="Email" required>
							<Input type="email" bind:value={editEmail} required />
						</FormField>

						<FormField label="Name">
							<Input bind:value={editName} placeholder="Full name" />
						</FormField>

						<FormField label="Status">
							<select class="select" bind:value={editStatus}>
								<option value="enabled">Enabled</option>
								<option value="disabled">Disabled</option>
								<option value="blocklisted">Blocklisted</option>
							</select>
						</FormField>

						<FormField label="Lists">
							{@render listCheckboxes(editListIds, (id) => (editListIds = toggleListId(id, editListIds)))}
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

	.search-bar {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.date {
		color: var(--color-muted);
		white-space: nowrap;
	}

	.muted {
		color: var(--color-muted);
	}

	.list-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
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

	/* ─── Row checkbox ─────────────────────────────────────────────────── */

	:global(.row-checkbox) {
		width: 1rem;
		height: 1rem;
		accent-color: var(--color-primary);
		cursor: pointer;
	}

	/* ─── Action bar ───────────────────────────────────────────────────── */

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

	.list-checkboxes {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.list-checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: var(--color-foreground);
		cursor: pointer;
	}

	.list-checkbox input[type='checkbox'] {
		accent-color: var(--color-primary);
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
