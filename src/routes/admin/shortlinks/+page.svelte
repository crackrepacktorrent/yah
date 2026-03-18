<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button, Input, Badge, Tooltip, FormField, Switch, EmptyState, Spinner, DataTable, ConfirmDialog, DialogShell } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel, getFilteredRowModel, getSortedRowModel, type SortingState, type RowSelectionState } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';
	import { listShortUrls, createShortUrl, deleteShortUrl } from '../shortlinks.remote';
	import { getSession } from '../session.remote';
	let role = $derived(getSession().current?.role);

	let shortlinksQuery = $derived(listShortUrls());
	let _prevShortlinks: typeof shortlinksQuery.current;
	let shortlinksData = $derived.by(() => {
		const val = shortlinksQuery.current;
		if (val !== undefined) _prevShortlinks = val;
		return val ?? _prevShortlinks;
	});

	let globalFilter = $state('');
	let sorting = $state<SortingState>([{ id: 'dateCreated', desc: true }]);
	let rowSelection = $state<RowSelectionState>({});

	let createOpen = $state(false);
	let createPending = $state(false);
	let confirmDelete = $state(false);

	let selectedRows = $derived.by(() => {
		const data = shortlinksQuery.current;
		if (!data) return [];
		return Object.keys(rowSelection)
			.filter((k) => rowSelection[k])
			.map((k) => data.shortUrls[Number(k)])
			.filter(Boolean);
	});
	let selectedCount = $derived(selectedRows.length);

	function clearSelection() {
		rowSelection = {};
	}

	async function handleDelete() {
		try {
			for (const url of selectedRows) {
				await deleteShortUrl(url.shortCode);
			}
			toast.success(`${selectedCount} shortlink${selectedCount > 1 ? 's' : ''} deleted.`);
			clearSelection();
			listShortUrls().refresh();
		} catch (err: any) {
			toast.error(err?.message || 'Failed to delete shortlink.');
		}
	}

	async function handleCreate(e: SubmitEvent) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const fd = new FormData(form);

		createPending = true;
		try {
			const result = await createShortUrl({
				longUrl: fd.get('longUrl') as string,
				customSlug: fd.get('customSlug') as string,
				title: fd.get('title') as string,
				tags: fd.get('tags') as string,
				maxVisits: fd.get('maxVisits') as string,
				validUntil: fd.get('validUntil') as string,
				crawlable: fd.has('crawlable'),
				forwardQuery: fd.has('forwardQuery'),
			});
			createOpen = false;
			toast.success('Shortlink created.');
			goto(`/admin/shortlinks/${result.shortCode}`);
		} catch (err: any) {
			toast.error(err?.message || 'Failed to create shortlink.');
		} finally {
			createPending = false;
		}
	}

	type ShortUrl = {
		shortCode: string;
		longUrl: string;
		title?: string | null;
		tags: string[];
		visitsSummary: { total: number };
		dateCreated: string;
	};

	const columnHelper = createColumnHelper<ShortUrl>();

	const columns = [
		columnHelper.display({
			id: 'select',
			header: (info) => renderSnippet(selectAllCell, info.table),
			cell: (info) => renderSnippet(selectRowCell, info.row),
			enableSorting: false,
		}),
		columnHelper.accessor('shortCode', {
			header: 'Short URL',
			cell: (info) => renderSnippet(shortCodeCell, info.row.original),
			enableSorting: true,
		}),
		columnHelper.accessor('longUrl', {
			header: 'Destination',
			cell: (info) => renderSnippet(longUrlCell, info.getValue()),
			enableSorting: true,
		}),
		columnHelper.accessor('tags', {
			header: 'Tags',
			cell: (info) => renderSnippet(tagsCell, info.getValue()),
			enableSorting: false,
		}),
		columnHelper.accessor((row) => row.visitsSummary.total, {
			id: 'visits',
			header: 'Clicks',
			cell: (info) => renderSnippet(clicksCell, info.getValue()),
			enableSorting: true,
		}),
		columnHelper.accessor('dateCreated', {
			header: 'Created',
			cell: (info) => renderSnippet(dateCell, info.getValue()),
			enableSorting: true,
		}),
	];
</script>

{#snippet selectAllCell(table: any)}
	<input type="checkbox" class="row-checkbox" checked={table.getIsAllRowsSelected()} indeterminate={table.getIsSomeRowsSelected()} onchange={table.getToggleAllRowsSelectedHandler()} />
{/snippet}

{#snippet selectRowCell(row: any)}
	<input type="checkbox" class="row-checkbox" checked={row.getIsSelected()} onchange={row.getToggleSelectedHandler()} />
{/snippet}

{#snippet shortCodeCell(url: ShortUrl)}
	<a href="/admin/shortlinks/{url.shortCode}" class="code">{url.shortCode}</a>
	{#if url.title}<br /><span class="title">{url.title}</span>{/if}
{/snippet}

{#snippet longUrlCell(longUrl: string)}
	<span class="long-url"><Tooltip text={longUrl}>{longUrl}</Tooltip></span>
{/snippet}

{#snippet tagsCell(tags: string[])}
	<div class="tags">
		{#each tags as tag}
			<Badge>{tag}</Badge>
		{/each}
	</div>
{/snippet}

{#snippet clicksCell(total: number)}
	<span class="clicks">{total}</span>
{/snippet}

{#snippet dateCell(date: string)}
	<span class="date">{new Date(date).toLocaleDateString()}</span>
{/snippet}

<h1>Shortlinks</h1>

{#if !shortlinksData && shortlinksQuery.loading}
	<Spinner size={48} centered />
{:else if shortlinksData}
	{#snippet toolbar()}
		{#if selectedCount > 0 && (role === 'admin' || role === 'owner')}
			<span class="toolbar-count">{selectedCount} selected</span>
			<div class="toolbar-actions">
				<Button variant="danger-outline" onclick={() => (confirmDelete = true)}>Delete</Button>
				<button class="toolbar-clear" onclick={clearSelection}>Clear</button>
			</div>
		{:else}
			<div class="toolbar-search">
				<Input type="text" placeholder="Filter shortlinks..." bind:value={globalFilter} />
			</div>
			{#if role === 'admin' || role === 'owner'}
				<Button variant="primary" onclick={() => (createOpen = true)}>+ New Shortlink</Button>
			{/if}
		{/if}
	{/snippet}

	{@const table = createSvelteTable({
		data: shortlinksData.shortUrls,
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

	{#if shortlinksData.shortUrls.length === 0}
		<EmptyState message="No shortlinks found." />
	{/if}
{/if}

<ConfirmDialog
	bind:open={confirmDelete}
	title="Delete Shortlink{selectedCount > 1 ? 's' : ''}"
	description="Permanently delete {selectedCount} shortlink{selectedCount > 1 ? 's' : ''}? This cannot be undone."
	confirmLabel="Yes, delete"
	onconfirm={handleDelete}
/>

{#if role === 'admin' || role === 'owner'}
<!-- Create Shortlink Dialog -->
<DialogShell bind:open={createOpen} title="New Shortlink" maxWidth="520px">
	<form class="create-form" onsubmit={handleCreate}>
		<FormField label="Destination URL" required>
			<Input name="longUrl" type="url" required placeholder="https://example.com/long/path" />
		</FormField>

		<FormField label="Custom Slug" hint="(optional — leave blank for auto-generated)">
			<Input name="customSlug" placeholder="my-link" />
		</FormField>

		<FormField label="Title" hint="(optional)">
			<Input name="title" placeholder="Descriptive title" />
		</FormField>

		<FormField label="Tags" hint="(comma-separated)">
			<Input name="tags" placeholder="campaign, social" />
		</FormField>

		<div class="row">
			<FormField label="Max Visits" hint="(optional)">
				<Input name="maxVisits" placeholder="Unlimited" />
			</FormField>

			<FormField label="Expires" hint="(optional)">
				<Input name="validUntil" type="date" min={new Date().toLocaleDateString('en-CA')} />
			</FormField>
		</div>

		<div class="switches">
			<Switch label="Forward query parameters" checked={true} name="forwardQuery" />
			<Switch label="Allow search engine crawling" checked={false} name="crawlable" />
		</div>

		<div class="actions">
			<button type="button" class="cancel-btn" onclick={() => (createOpen = false)}>Cancel</button>
			<Button variant="primary" type="submit" disabled={createPending}>
				{createPending ? 'Creating...' : 'Create Shortlink'}
			</Button>
		</div>
	</form>
</DialogShell>
{/if}

<style>
	h1 {
		margin: 0 0 1.5rem;
		color: var(--color-foreground);
	}

	.code {
		font-family: monospace;
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 600;
	}

	.code:hover {
		text-decoration: underline;
	}

	.title {
		font-size: 0.8rem;
		color: var(--color-muted);
	}

	.long-url {
		display: block;
		max-width: 300px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--color-muted);
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.clicks {
		font-weight: 600;
		color: var(--brand-amber-dark);
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

	.create-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	@media (max-width: 640px) {
		.row {
			grid-template-columns: 1fr;
		}
	}

	.switches {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
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
