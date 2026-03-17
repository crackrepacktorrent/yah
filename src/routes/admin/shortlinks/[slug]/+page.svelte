<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Card, Button, FormField, Table, StatCard, Badge, ConfirmDialog, Switch, Tooltip } from '$lib/components/admin';
	import { getShortUrl, editShortUrl, deleteShortUrl, resetShortUrlVisits } from '../../shortlinks.remote';

	let slug = $derived($page.params.slug);
	let editing = $state(false);
	let confirmDelete = $state(false);
	let confirmReset = $state(false);
	let editSuccess = $state(false);
	let editForwardQuery = $state(false);
	let editCrawlable = $state(false);
</script>

{#if slug}
{#await getShortUrl(slug)}
	<p class="loading">Loading...</p>
{:then data}
	<div class="header">
		<div>
			<a href="/admin/shortlinks" class="back">← All Shortlinks</a>
			<h1>
				<span class="code">{data.shortUrl.shortCode}</span>
				{#if data.shortUrl.title}
					<span class="title">— {data.shortUrl.title}</span>
				{/if}
			</h1>
		</div>
		<div class="header-actions">
			<Button variant="secondary" onclick={() => { editing = !editing; editSuccess = false; if (editing) { editForwardQuery = data.shortUrl.forwardQuery; editCrawlable = data.shortUrl.crawlable; } }}>
				{editing ? 'Cancel' : 'Edit'}
			</Button>
		</div>
	</div>

	{#each editShortUrl.fields.longUrl.issues() as issue}
		<p class="alert alert-error">{issue.message}</p>
	{/each}

	{#if editShortUrl.result?.success || editSuccess}
		<p class="alert alert-success">Shortlink updated.</p>
	{/if}

	{#if resetShortUrlVisits.result}
		<p class="alert alert-success">Deleted {resetShortUrlVisits.result.deletedCount} visit(s).</p>
	{/if}

	{#if editing}
		<Card maxWidth="600px">
			<form
				{...editShortUrl.enhance(async ({ submit }) => {
					await submit();
					if (editShortUrl.result?.success) {
						editing = false;
						editSuccess = true;
						getShortUrl(slug).refresh();
					}
				})}
				class="edit-form"
			>
				<input {...editShortUrl.fields.shortCode.as('text')} type="hidden" value={data.shortUrl.shortCode} />

				<FormField label="Destination URL">
					<input {...editShortUrl.fields.longUrl.as('url')} class="admin-input" value={data.shortUrl.longUrl} required />
				</FormField>

				<FormField label="Title">
					<input {...editShortUrl.fields.title.as('text')} class="admin-input" value={data.shortUrl.title ?? ''} />
				</FormField>

				<FormField label="Tags" hint="(comma-separated)">
					<input {...editShortUrl.fields.tags.as('text')} class="admin-input" value={data.shortUrl.tags.join(', ')} />
				</FormField>

				<div class="row">
					<FormField label="Max Visits">
						<input {...editShortUrl.fields.maxVisits.as('text')} class="admin-input" value={data.shortUrl.meta.maxVisits ?? ''} placeholder="Unlimited" />
					</FormField>

					<FormField label="Expires">
						<input {...editShortUrl.fields.validUntil.as('text')} type="date" class="admin-input" min={new Date().toLocaleDateString('en-CA')} value={data.shortUrl.meta.validUntil?.slice(0, 10) ?? ''} />
					</FormField>
				</div>

				<div class="switches">
					<Switch label="Forward query parameters" bind:checked={editForwardQuery} name="forwardQuery" />
					<Switch label="Allow search engine crawling" bind:checked={editCrawlable} name="crawlable" />
				</div>

				<Button variant="primary" type="submit" disabled={editShortUrl.pending}>
					{editShortUrl.pending ? 'Saving...' : 'Save Changes'}
				</Button>
			</form>
		</Card>

		<hr />

		<Card maxWidth="600px" class="danger-card">
			<h3 class="danger-title">Danger Zone</h3>

			<Button variant="danger-outline" onclick={() => (confirmReset = true)}>Reset Visit Stats</Button>
			<Button variant="danger-outline" onclick={() => (confirmDelete = true)}>Delete Shortlink</Button>

			<ConfirmDialog
				bind:open={confirmReset}
				title="Reset Visit Stats"
				description="Reset all visit stats for this shortlink? This cannot be undone."
				confirmLabel="Yes, reset visits"
			>
				<form
					{...resetShortUrlVisits.enhance(async ({ submit }) => {
						await submit();
						confirmReset = false;
						getShortUrl(slug).refresh();
					})}
				>
					<input {...resetShortUrlVisits.fields.shortCode.as('text')} type="hidden" value={data.shortUrl.shortCode} />
					<Button variant="danger" type="submit" disabled={resetShortUrlVisits.pending}>Yes, reset visits</Button>
				</form>
			</ConfirmDialog>

			<ConfirmDialog
				bind:open={confirmDelete}
				title="Delete Shortlink"
				description="Permanently delete {data.shortUrl.shortCode}? This cannot be undone."
				confirmLabel="Yes, delete"
			>
				<form
					{...deleteShortUrl.enhance(async ({ submit }) => {
						await submit();
						goto('/admin/shortlinks');
					})}
				>
					<input {...deleteShortUrl.fields.shortCode.as('text')} type="hidden" value={data.shortUrl.shortCode} />
					<Button variant="danger" type="submit" disabled={deleteShortUrl.pending}>Yes, delete</Button>
				</form>
			</ConfirmDialog>
		</Card>
	{:else}
		<div class="detail-grid">
			<Card>
				<span class="label">Short URL</span>
				<a href={data.shortUrl.shortUrl} target="_blank" rel="noopener">{data.shortUrl.shortUrl}</a>
			</Card>
			<Card>
				<span class="label">Destination</span>
				<Tooltip text={data.shortUrl.longUrl}>
					<a href={data.shortUrl.longUrl} target="_blank" rel="noopener" class="long-url">{data.shortUrl.longUrl}</a>
				</Tooltip>
			</Card>
			<Card>
				<span class="label">Created</span>
				<span>{new Date(data.shortUrl.dateCreated).toLocaleString()}</span>
			</Card>
			{#if data.shortUrl.tags.length > 0}
				<Card>
					<span class="label">Tags</span>
					<div class="tags">
						{#each data.shortUrl.tags as tag}
							<Badge>{tag}</Badge>
						{/each}
					</div>
				</Card>
			{/if}
			{#if data.shortUrl.meta.maxVisits}
				<Card>
					<span class="label">Max Visits</span>
					<span>{data.shortUrl.meta.maxVisits}</span>
				</Card>
			{/if}
			{#if data.shortUrl.meta.validUntil}
				<Card>
					<span class="label">Expires</span>
					<span>{new Date(data.shortUrl.meta.validUntil).toLocaleString()}</span>
				</Card>
			{/if}
		</div>

		<section class="stats">
			<div class="stats-row">
				<StatCard value={data.shortUrl.visitsSummary.total} label="Total Clicks" />
				<StatCard value={data.shortUrl.visitsSummary.nonBots} label="Human" />
				<StatCard value={data.shortUrl.visitsSummary.bots} label="Bots" />
			</div>
		</section>

		<section class="visits">
			<h2>Recent Visits</h2>
			{#if data.visits.length === 0}
				<p class="empty">No visits yet.</p>
			{:else}
				<Table>
					<thead>
						<tr>
							<th>Date</th>
							<th>Referer</th>
							<th>Location</th>
							<th>User Agent</th>
						</tr>
					</thead>
					<tbody>
						{#each data.visits as visit}
							<tr>
								<td class="date">{new Date(visit.date).toLocaleString()}</td>
								<td class="referer">{visit.referer || '(direct)'}</td>
								<td>
									{#if visit.visitLocation}
										{visit.visitLocation.cityName || ''}{visit.visitLocation.cityName && visit.visitLocation.countryCode ? ', ' : ''}{visit.visitLocation.countryCode || ''}
									{:else}
										—
									{/if}
								</td>
								<td class="ua">{visit.userAgent || '—'}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
				{#if data.visitsPagination.totalItems > 20}
					<p class="more">Showing 20 of {data.visitsPagination.totalItems} visits</p>
				{/if}
			{/if}
		</section>
	{/if}
{/await}
{/if}

<style>
	.loading {
		color: var(--color-muted);
	}

	.header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}

	.back {
		font-size: 0.85rem;
		color: var(--color-muted);
		text-decoration: none;
		transition: color 0.15s;
	}

	.back:hover {
		color: var(--color-primary);
	}

	h1 {
		margin: 0.25rem 0 0;
		font-size: 1.5rem;
		color: var(--color-foreground);
	}

	.code {
		font-family: monospace;
		color: var(--color-primary);
	}

	.title {
		font-weight: 400;
		color: var(--color-muted);
		font-size: 1.1rem;
	}

	.alert {
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-md);
		font-size: 0.9rem;
	}

	.alert-error {
		color: var(--color-destructive);
		background: var(--color-destructive-bg);
	}

	.alert-success {
		color: var(--color-success);
		background: var(--color-success-bg);
	}

	/* Detail view */
	.detail-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	@media (max-width: 640px) {
		.detail-grid {
			grid-template-columns: 1fr;
		}
	}

	.label {
		display: block;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--color-muted);
		margin-bottom: 0.25rem;
	}

	.long-url {
		font-size: 0.9rem;
		color: var(--color-foreground);
		word-break: break-all;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	/* Stats */
	.stats {
		margin-bottom: 2rem;
	}

	.stats-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	@media (max-width: 768px) {
		.stats-row {
			grid-template-columns: 1fr;
		}
	}

	/* Visits */
	h2 {
		font-size: 1.1rem;
		margin-bottom: 1rem;
		color: var(--color-foreground);
	}

	.date {
		white-space: nowrap;
		color: var(--color-muted);
	}

	.referer {
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--color-muted);
	}

	.ua {
		max-width: 250px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--color-muted);
		font-size: 0.8rem;
	}

	.more {
		text-align: center;
		color: var(--color-muted);
		font-size: 0.85rem;
		margin-top: 0.75rem;
	}

	.empty {
		color: var(--color-muted);
	}

	/* Edit form */
	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
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

	hr {
		border: none;
		border-top: 1px solid var(--color-border-medium);
		margin: 2rem 0;
	}

	/* Danger zone */
	:global(.danger-card) {
		border: 1px solid var(--color-destructive-border);
	}

	.danger-title {
		color: var(--color-destructive);
		font-size: 0.95rem;
		margin: 0 0 1rem;
	}
</style>
