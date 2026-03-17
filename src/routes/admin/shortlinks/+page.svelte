<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Button, Input, Badge, Tooltip, PaginationNav, FormField, Switch, EmptyState, Spinner, DataTable } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel, type SortingState } from '@tanstack/table-core';
	import { Dialog } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import { listShortUrls, createShortUrl } from '../shortlinks.remote';
	import { getSession } from '../session.remote';
	let role = $derived(getSession().current?.role);

	let search = $state($page.url.searchParams.get('search') || '');
	let currentPage = $derived(Number($page.url.searchParams.get('page')) || 1);
	let orderBy = $derived($page.url.searchParams.get('orderBy') || 'dateCreated-DESC');

	let shortlinksQuery = $derived(listShortUrls({ page: currentPage, search, orderBy }));
	let _prev: typeof shortlinksQuery.current;
	let data = $derived.by(() => {
		const val = shortlinksQuery.current;
		if (val !== undefined) _prev = val;
		return val ?? _prev;
	});

	let createOpen = $state(false);
	let createPending = $state(false);

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

	function handleSearch(e: Event) {
		e.preventDefault();
		const params = new URLSearchParams($page.url.searchParams);
		if (search) {
			params.set('search', search);
		} else {
			params.delete('search');
		}
		params.delete('page');
		goto(`/admin/shortlinks?${params.toString()}`);
	}

	function pageUrl(p: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(p));
		return `/admin/shortlinks?${params.toString()}`;
	}

	const sortFieldMap: Record<string, string> = {
		dateCreated: 'dateCreated',
		shortCode: 'shortCode',
		longUrl: 'longUrl',
		visits: 'visits',
	};

	let sorting = $derived.by<SortingState>(() => {
		const [field, dir] = orderBy.split('-');
		if (sortFieldMap[field]) {
			return [{ id: sortFieldMap[field], desc: dir === 'DESC' }];
		}
		return [];
	});

	function onSortingChange(updater: any) {
		const next: SortingState = typeof updater === 'function' ? updater(sorting) : updater;
		if (next.length > 0) {
			const { id, desc } = next[0];
			const field = sortFieldMap[id] || id;
			const params = new URLSearchParams($page.url.searchParams);
			params.set('orderBy', `${field}-${desc ? 'DESC' : 'ASC'}`);
			params.delete('page');
			goto(`/admin/shortlinks?${params.toString()}`);
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

<div class="header">
	<h1>Shortlinks</h1>
	{#if role === 'admin' || role === 'owner'}
		<Button variant="primary" onclick={() => (createOpen = true)}>+ New Shortlink</Button>
	{/if}
</div>

<form class="search-bar" onsubmit={handleSearch}>
	<Input type="text" placeholder="Search by slug or URL..." bind:value={search} />
	<Button variant="secondary" type="submit">Search</Button>
</form>

{#if !data && shortlinksQuery.loading}
	<Spinner size={48} centered />
{:else if data}
	{#if data.shortUrls.length === 0}
		<EmptyState message="No shortlinks found." />
	{:else}
		{@const table = createSvelteTable({
			data: data.shortUrls,
			columns,
			state: { sorting },
			onSortingChange,
			getCoreRowModel: getCoreRowModel(),
			manualSorting: true,
			manualPagination: true,
			enableSortingRemoval: false,
})}
		<DataTable {table} />

		{#if data.pagination.pagesCount > 1}
			<PaginationNav
				count={data.pagination.totalItems}
				perPage={20}
				page={data.pagination.currentPage}
				onPageChange={(p) => goto(pageUrl(p))}
			/>
		{/if}
	{/if}
{/if}

{#if role === 'admin' || role === 'owner'}
<!-- Create Shortlink Dialog -->
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
						<h2>New Shortlink</h2>
						<Dialog.Close>
							{#snippet child({ props: closeProps })}
								<button {...closeProps} class="dialog-close">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<line x1="18" y1="6" x2="6" y2="18"></line>
										<line x1="6" y1="6" x2="18" y2="18"></line>
									</svg>
								</button>
							{/snippet}
						</Dialog.Close>
					</div>

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
				</div>
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
{/if}

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
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
	}

	.dialog-close:hover {
		color: var(--color-foreground);
		background: var(--color-hover);
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
