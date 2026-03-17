<script lang="ts">
	import { StatCard, Table } from '$lib/components/admin';
	import { getDashboard } from './shortlinks.remote';
</script>

<h1>Dashboard</h1>

{#await getDashboard()}
	<p class="loading">Loading...</p>
{:then data}
	<div class="stats-grid">
		<StatCard value={data.totalShortUrls} label="Short URLs" />
		<StatCard value={data.visits.nonOrphanVisits.total.toLocaleString()} label="Total Clicks" />
		<StatCard value={data.visits.nonOrphanVisits.nonBots.toLocaleString()} label="Human Clicks" />
		<StatCard value={data.visits.nonOrphanVisits.bots.toLocaleString()} label="Bot Clicks" />
	</div>

	<section class="recent">
		<div class="section-header">
			<h2>Recent Shortlinks</h2>
			<a href="/admin/shortlinks" class="view-all">View all →</a>
		</div>

		{#if data.recentShortUrls.length === 0}
			<p class="empty">No shortlinks yet. <a href="/admin/shortlinks/new">Create one</a>.</p>
		{:else}
			<Table>
				<thead>
					<tr>
						<th>Short URL</th>
						<th>Destination</th>
						<th>Clicks</th>
						<th>Created</th>
					</tr>
				</thead>
				<tbody>
					{#each data.recentShortUrls as url}
						<tr>
							<td>
								<a href="/admin/shortlinks/{url.shortCode}" class="code">{url.shortCode}</a>
								{#if url.title}<br /><span class="title">{url.title}</span>{/if}
							</td>
							<td class="long-url" title={url.longUrl}>{url.longUrl}</td>
							<td class="clicks">{url.visitsSummary.total}</td>
							<td class="date">{new Date(url.dateCreated).toLocaleDateString()}</td>
						</tr>
					{/each}
				</tbody>
			</Table>
		{/if}
	</section>
{/await}

<style>
	h1 {
		margin-bottom: 1.5rem;
		color: var(--color-foreground);
	}

	.loading {
		color: var(--color-muted);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 2rem;
	}

	@media (max-width: 768px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	h2 {
		font-size: 1.1rem;
		margin: 0;
		color: var(--color-foreground);
	}

	.view-all {
		font-size: 0.85rem;
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 500;
	}

	.view-all:hover {
		text-decoration: underline;
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

	.clicks {
		font-weight: 600;
	}

	.date {
		color: var(--color-muted);
	}

	.empty {
		color: var(--color-muted);
	}

	.empty a {
		color: var(--color-primary);
	}
</style>
