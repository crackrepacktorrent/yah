<script lang="ts">
	import { StatCard, Table, EmptyState, Spinner } from '$lib/components/admin';
	import { getDashboard } from './shortlinks.remote';
</script>

<h1>Dashboard</h1>

{#await getDashboard()}
	<Spinner size={48} centered />
{:then data}
	<div class="stats-grid">
		<StatCard value={data.totalShortUrls} label="Short URLs" accent="var(--brand-orange)" />
		<StatCard value={data.visits.nonOrphanVisits.total.toLocaleString()} label="Total Clicks" accent="var(--brand-amber)" />
		<StatCard value={data.visits.nonOrphanVisits.nonBots.toLocaleString()} label="Human Clicks" accent="var(--brand-olive)" />
		<StatCard value={data.visits.nonOrphanVisits.bots.toLocaleString()} label="Bot Clicks" accent="var(--brand-magenta)" />
	</div>

	<section class="recent">
		<div class="section-header">
			<h2>Recent Shortlinks</h2>
			<a href="/admin/shortlinks" class="view-all">View all →</a>
		</div>

		{#if data.recentShortUrls.length === 0}
			<EmptyState message="No shortlinks yet.">
				<a href="/admin/shortlinks/new">Create one</a>
			</EmptyState>
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

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
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

	:global(td).clicks {
		font-weight: 600;
		color: var(--brand-amber-dark);
	}

	.date {
		color: var(--color-muted);
	}

</style>
