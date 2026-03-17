<script lang="ts">
	import { StatCard, EmptyState, Spinner, DataTable } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel } from '@tanstack/table-core';
	import { getDashboard } from './shortlinks.remote';
	import { getSiteStats } from './analytics.remote';

	function formatDuration(seconds: number) {
		if (seconds < 60) return `${seconds}s`;
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}m ${s}s`;
	}

	type RecentShortUrl = {
		shortCode: string;
		longUrl: string;
		title?: string | null;
		visitsSummary: { total: number };
		dateCreated: string;
	};

	const columnHelper = createColumnHelper<RecentShortUrl>();

	const columns = [
		columnHelper.accessor('shortCode', {
			header: 'Short URL',
			cell: (info) => renderSnippet(shortCodeCell, info.row.original),
		}),
		columnHelper.accessor('longUrl', {
			header: 'Destination',
			cell: (info) => renderSnippet(longUrlCell, info.getValue()),
		}),
		columnHelper.accessor((row) => row.visitsSummary.total, {
			id: 'clicks',
			header: 'Clicks',
			cell: (info) => renderSnippet(clicksCell, info.getValue()),
		}),
		columnHelper.accessor('dateCreated', {
			header: 'Created',
			cell: (info) => renderSnippet(dateCell, info.getValue()),
		}),
	];
</script>

{#snippet shortCodeCell(url: RecentShortUrl)}
	<a href="/admin/shortlinks/{url.shortCode}" class="code">{url.shortCode}</a>
	{#if url.title}<br /><span class="title">{url.title}</span>{/if}
{/snippet}

{#snippet longUrlCell(longUrl: string)}
	<span class="long-url" title={longUrl}>{longUrl}</span>
{/snippet}

{#snippet clicksCell(total: number)}
	<span class="clicks">{total}</span>
{/snippet}

{#snippet dateCell(date: string)}
	<span class="date">{new Date(date).toLocaleDateString()}</span>
{/snippet}

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
			{@const table = createSvelteTable({
				data: data.recentShortUrls,
				columns,
				getCoreRowModel: getCoreRowModel(),
})}
			<DataTable {table} />
		{/if}
	</section>
{/await}

{#await getSiteStats() then stats}
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
		display: block;
		max-width: 300px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--color-muted);
	}

	.clicks {
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
