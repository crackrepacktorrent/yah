<script lang="ts">
	import { StatCard, EmptyState, DataTable, Section } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel } from '@tanstack/table-core';
	import { getDashboard } from './shortlinks.remote';
	import { getSiteStats } from './analytics.remote';

	let [dashboardData, siteStats] = $derived(await Promise.all([getDashboard(), getSiteStats()]));

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
			enableColumnFilter: false,
		}),
		columnHelper.accessor('longUrl', {
			header: 'Destination',
			cell: (info) => renderSnippet(longUrlCell, info.getValue()),
			enableColumnFilter: false,
		}),
		columnHelper.accessor((row) => row.visitsSummary.total, {
			id: 'clicks',
			header: 'Clicks',
			cell: (info) => renderSnippet(clicksCell, info.getValue()),
			enableColumnFilter: false,
		}),
		columnHelper.accessor('dateCreated', {
			header: 'Created',
			cell: (info) => renderSnippet(dateCell, info.getValue()),
			enableColumnFilter: false,
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
	<span class="cell-date">{new Date(date).toLocaleDateString()}</span>
{/snippet}

<h1>Dashboard</h1>

{#if dashboardData}
	<div class="stats-grid stats-grid-bottom">
		<StatCard value={dashboardData.totalShortUrls} label="Short URLs" accent="var(--brand-orange)" />
		<StatCard value={dashboardData.visits.nonOrphanVisits.total.toLocaleString()} label="Total Clicks" accent="var(--brand-amber)" />
		<StatCard value={dashboardData.visits.nonOrphanVisits.nonBots.toLocaleString()} label="Human Clicks" accent="var(--brand-olive)" />
		<StatCard value={dashboardData.visits.nonOrphanVisits.bots.toLocaleString()} label="Bot Clicks" accent="var(--brand-magenta)" />
	</div>

	<section class="dashboard-section">
		<h2>Recent Shortlinks</h2>
		{#if dashboardData.recentShortUrls.length === 0}
			<EmptyState message="No shortlinks yet." />
		{:else}
			{@const table = createSvelteTable({
				data: dashboardData.recentShortUrls,
				columns,
				getCoreRowModel: getCoreRowModel(),
})}
			<DataTable {table} />
		{/if}
	</section>
{/if}

{#if siteStats}
	<section class="dashboard-section">
		<h2>Site Analytics</h2>
		<div class="analytics-periods">
			<Section title="Last 24 Hours">
				<div class="stats-grid">
					<StatCard value={siteStats.today.pageviews.toLocaleString()} label="Pageviews" accent="var(--brand-olive)" />
					<StatCard value={siteStats.today.visitors.toLocaleString()} label="Visitors" accent="var(--brand-amber)" />
					<StatCard value="{siteStats.today.bounceRate}%" label="Bounce Rate" accent="var(--brand-magenta)" />
					<StatCard value={formatDuration(siteStats.today.avgTime)} label="Avg. Visit" accent="var(--brand-orange)" />
				</div>
			</Section>

			<Section title="Last 30 Days">
				<div class="stats-grid">
					<StatCard value={siteStats.month.pageviews.toLocaleString()} label="Pageviews" accent="var(--brand-olive)" />
					<StatCard value={siteStats.month.visitors.toLocaleString()} label="Visitors" accent="var(--brand-amber)" />
					<StatCard value="{siteStats.month.bounceRate}%" label="Bounce Rate" accent="var(--brand-magenta)" />
					<StatCard value={formatDuration(siteStats.month.avgTime)} label="Avg. Visit" accent="var(--brand-orange)" />
				</div>
			</Section>
		</div>
	</section>
{/if}

<style>
	.stats-grid-bottom {
		margin-bottom: 2rem;
	}

	.dashboard-section {
		margin-top: 2rem;
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

	.analytics-periods {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	.analytics-periods :global(.stats-grid) {
		grid-template-columns: repeat(2, 1fr);
	}

	@media (max-width: 768px) {
		.analytics-periods {
			grid-template-columns: 1fr;
		}

		.analytics-periods :global(.stats-grid) {
			grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		}
	}
</style>
