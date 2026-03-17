<script lang="ts">
	import { StatCard, Table, EmptyState, Spinner, Section } from '$lib/components/admin';
	import { getDashboard } from './shortlinks.remote';
	import { getSiteStats } from './analytics.remote';

	function formatDuration(seconds: number) {
		if (seconds < 60) return `${seconds}s`;
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}m ${s}s`;
	}
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

{#await getSiteStats() then stats}
	{#if stats}
		<section class="site-analytics">
			<div class="section-header">
				<h2>Site Analytics</h2>
			</div>

			<div class="analytics-periods">
				<div class="period">
					<h3>Last 24 Hours</h3>
					<div class="stats-grid">
						<StatCard value={stats.today.pageviews.toLocaleString()} label="Pageviews" accent="var(--brand-olive)" />
						<StatCard value={stats.today.visitors.toLocaleString()} label="Visitors" accent="var(--brand-amber)" />
						<StatCard value="{stats.today.bounceRate}%" label="Bounce Rate" accent="var(--brand-magenta)" />
						<StatCard value={formatDuration(stats.today.avgTime)} label="Avg. Visit" accent="var(--brand-orange)" />
					</div>
				</div>

				<div class="period">
					<h3>Last 30 Days</h3>
					<div class="stats-grid">
						<StatCard value={stats.month.pageviews.toLocaleString()} label="Pageviews" accent="var(--brand-olive)" />
						<StatCard value={stats.month.visitors.toLocaleString()} label="Visitors" accent="var(--brand-amber)" />
						<StatCard value="{stats.month.bounceRate}%" label="Bounce Rate" accent="var(--brand-magenta)" />
						<StatCard value={formatDuration(stats.month.avgTime)} label="Avg. Visit" accent="var(--brand-orange)" />
					</div>
				</div>
			</div>
		</section>
	{/if}
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

	.site-analytics {
		margin-top: 2rem;
	}

	.analytics-periods {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	.period h3 {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-muted);
		margin: 0 0 0.75rem;
	}

	.period .stats-grid {
		grid-template-columns: repeat(2, 1fr);
		margin-bottom: 0;
	}

	@media (max-width: 768px) {
		.analytics-periods {
			grid-template-columns: 1fr;
		}

		.period .stats-grid {
			grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		}
	}
</style>
