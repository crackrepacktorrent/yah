<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Button, Input, Table, Badge, Tooltip, PaginationNav } from '$lib/components/admin';
	import { listShortUrls } from '../shortlinks.remote';

	let search = $state($page.url.searchParams.get('search') || '');
	let currentPage = $derived(Number($page.url.searchParams.get('page')) || 1);
	let orderBy = $derived($page.url.searchParams.get('orderBy') || 'dateCreated-DESC');

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
</script>

<div class="header">
	<h1>Shortlinks</h1>
	<Button variant="primary" href="/admin/shortlinks/new">+ New Shortlink</Button>
</div>

<form class="search-bar" onsubmit={handleSearch}>
	<Input type="text" placeholder="Search by slug or URL..." bind:value={search} />
	<Button variant="secondary" type="submit">Search</Button>
</form>

{#await listShortUrls({ page: currentPage, search, orderBy })}
	<p class="loading">Loading...</p>
{:then data}
	{#if data.shortUrls.length === 0}
		<p class="empty">No shortlinks found.</p>
	{:else}
		<Table>
			<thead>
				<tr>
					<th>Short URL</th>
					<th>Destination</th>
					<th>Tags</th>
					<th>Clicks</th>
					<th>Created</th>
				</tr>
			</thead>
			<tbody>
				{#each data.shortUrls as url}
					<tr>
						<td>
							<a href="/admin/shortlinks/{url.shortCode}" class="code">{url.shortCode}</a>
							{#if url.title}<br /><span class="title">{url.title}</span>{/if}
						</td>
						<td class="long-url">
								<Tooltip text={url.longUrl}>{url.longUrl}</Tooltip>
							</td>
						<td class="tags">
							{#each url.tags as tag}
								<Badge>{tag}</Badge>
							{/each}
						</td>
						<td class="clicks">{url.visitsSummary.total}</td>
						<td class="date">{new Date(url.dateCreated).toLocaleDateString()}</td>
					</tr>
				{/each}
			</tbody>
		</Table>

		{#if data.pagination.pagesCount > 1}
			<PaginationNav
				count={data.pagination.totalItems}
				perPage={20}
				page={data.pagination.currentPage}
				onPageChange={(p) => goto(pageUrl(p))}
			/>
		{/if}
	{/if}
{/await}

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

	.loading {
		color: var(--color-muted);
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
	}

	.date {
		color: var(--color-muted);
		white-space: nowrap;
	}

	.empty {
		color: var(--color-muted);
	}

</style>
