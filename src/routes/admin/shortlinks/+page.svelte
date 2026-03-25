<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button, Input, Badge, Tooltip, FormField, Switch, EmptyState, DataTable, ConfirmDialog, DialogShell, DatePicker, TagInput } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet, createSelectColumn } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel, getFilteredRowModel, getSortedRowModel, type SortingState, type RowSelectionState } from '@tanstack/table-core';
	import { today, getLocalTimeZone } from '@internationalized/date';
	import { toast } from 'svelte-sonner';
	import { toastError } from '$lib/utils/toast-error';
	import { useForm } from '$lib/utils/use-form.svelte';
	import * as v from 'valibot';
	import { listShortUrls, createShortUrl, deleteShortUrl } from '../shortlinks.remote';
	import { getSession } from '../session.remote';
	import { can } from '../can';
	let [session, shortlinksData] = $derived(await Promise.all([getSession(), listShortUrls()]));

	let globalFilter = $state('');
	let sorting = $state<SortingState>([{ id: 'dateCreated', desc: true }]);
	let rowSelection = $state<RowSelectionState>({});

	let createOpen = $state(false);
	let createPending = $state(false);
	let confirmDelete = $state(false);

	const createSchema = v.object({
		longUrl: v.pipe(v.string(), v.nonEmpty('Destination URL is required'), v.url('Must be a valid URL')),
		customSlug: v.string(),
		title: v.string(),
		tags: v.array(v.string()),
		maxVisits: v.string(),
		validUntil: v.string(),
		crawlable: v.boolean(),
		forwardQuery: v.boolean(),
	});

	const createForm = useForm({
		longUrl: '',
		customSlug: '',
		title: '',
		tags: [] as string[],
		maxVisits: '',
		validUntil: '',
		crawlable: false,
		forwardQuery: true,
	}, createSchema);

	let selectedRows = $derived.by(() => {
		if (!shortlinksData) return [];
		return Object.keys(rowSelection)
			.filter((k) => rowSelection[k])
			.map((k) => shortlinksData.shortUrls[Number(k)])
			.filter(Boolean);
	});
	let selectedCount = $derived(selectedRows.length);

	function clearSelection() {
		rowSelection = {};
	}

	async function handleDelete() {
		try {
			await Promise.all(selectedRows.map((url) => deleteShortUrl(url.shortCode)));
			toast.success(`${selectedCount} shortlink${selectedCount > 1 ? 's' : ''} deleted.`);
			clearSelection();
			listShortUrls().refresh();
		} catch (err) {
			toastError(err, 'Failed to delete shortlink.');
		}
	}

	async function handleCreate() {
		if (!createForm.validate()) return;
		createPending = true;
		try {
			const result = await createShortUrl({
				longUrl: createForm.values.longUrl,
				customSlug: createForm.values.customSlug,
				title: createForm.values.title,
				tags: createForm.values.tags,
				maxVisits: createForm.values.maxVisits ? (parseInt(createForm.values.maxVisits, 10) || null) : null,
				validUntil: createForm.values.validUntil,
				crawlable: createForm.values.crawlable,
				forwardQuery: createForm.values.forwardQuery,
			});
			createOpen = false;
			createForm.reset();
			toast.success('Shortlink created.');
			goto(`/admin/shortlinks/${result.shortCode}`);
		} catch (err) {
			toastError(err, 'Failed to create shortlink.');
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
		createSelectColumn<ShortUrl>(),
		columnHelper.accessor('shortCode', {
			header: 'Short URL',
			cell: (info) => renderSnippet(shortCodeCell, info.row.original),
			enableSorting: true,
			enableColumnFilter: false,
		}),
		columnHelper.accessor('longUrl', {
			header: 'Destination',
			cell: (info) => renderSnippet(longUrlCell, info.getValue()),
			enableSorting: true,
			enableColumnFilter: false,
		}),
		columnHelper.accessor('tags', {
			header: 'Tags',
			cell: (info) => renderSnippet(tagsCell, info.getValue()),
			enableSorting: false,
			enableColumnFilter: false,
		}),
		columnHelper.accessor((row) => row.visitsSummary.total, {
			id: 'visits',
			header: 'Clicks',
			cell: (info) => renderSnippet(clicksCell, info.getValue()),
			enableSorting: true,
			enableColumnFilter: false,
		}),
		columnHelper.accessor('dateCreated', {
			header: 'Created',
			cell: (info) => renderSnippet(dateCell, info.getValue()),
			enableSorting: true,
			enableColumnFilter: false,
		}),
	];
</script>

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
	<span class="cell-date">{new Date(date).toLocaleDateString()}</span>
{/snippet}

<h1>Shortlinks</h1>

{#if shortlinksData}
	{#snippet toolbar()}
		{#if selectedCount > 0 && can(session, 'shortlink', 'delete')}
			<span class="toolbar-count">{selectedCount} selected</span>
			<div class="toolbar-actions">
				<Button variant="danger-outline" onclick={() => (confirmDelete = true)}>Delete</Button>
				<button class="toolbar-clear" onclick={clearSelection}>Clear</button>
			</div>
		{:else}
			<div class="toolbar-search">
				<Input type="text" placeholder="Filter shortlinks..." bind:value={globalFilter} />
			</div>
			{#if can(session, 'shortlink', 'create')}
				<Button variant="primary" onclick={() => { createForm.reset(); createOpen = true; }}>+ New Shortlink</Button>
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

{#if can(session, 'shortlink', 'create')}
<!-- Create Shortlink Dialog -->
<DialogShell bind:open={createOpen} title="New Shortlink" maxWidth="520px">
	<div class="form-fields">
		<FormField label="Destination URL" required error={createForm.fieldError('longUrl')}>
			<Input bind:value={createForm.values.longUrl} onblur={() => createForm.touch('longUrl')} type="url" placeholder="https://example.com/long/path" />
		</FormField>

		<FormField label="Custom Slug" hint="(optional — leave blank for auto-generated)">
			<Input bind:value={createForm.values.customSlug} placeholder="my-link" />
		</FormField>

		<FormField label="Title" hint="(optional)">
			<Input bind:value={createForm.values.title} placeholder="Descriptive title" />
		</FormField>

		<FormField label="Tags" hint="Press Enter to add">
			<TagInput bind:tags={createForm.values.tags} placeholder="Add a tag..." />
		</FormField>

		<div class="form-row">
			<FormField label="Max Visits" hint="(optional)">
				<Input bind:value={createForm.values.maxVisits} placeholder="Unlimited" />
			</FormField>

			<FormField label="Expires" hint="(optional)">
				<DatePicker bind:value={createForm.values.validUntil} minValue={today(getLocalTimeZone())} />
			</FormField>
		</div>

		<div class="switches">
			<Switch label="Forward query parameters" bind:checked={createForm.values.forwardQuery} />
			<Switch label="Allow search engine crawling" bind:checked={createForm.values.crawlable} />
		</div>

		<div class="dialog-actions">
			<Button variant="ghost" onclick={() => (createOpen = false)}>Cancel</Button>
			<Button variant="primary" onclick={handleCreate} disabled={createPending}>
				{createPending ? 'Creating...' : 'Create Shortlink'}
			</Button>
		</div>
	</div>
</DialogShell>
{/if}

<style>
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

	.switches {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
</style>
