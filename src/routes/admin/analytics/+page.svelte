<script lang="ts">
	import { StatCard, EmptyState, Spinner, Card, DataTable, Section, ToggleGroup } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel } from '@tanstack/table-core';
	import { getAnalytics } from '../analytics.remote';
	import type { UmamiPageview } from '$lib/server/umami';
	let period = $state<'24h' | '7d' | '30d'>('7d');
	let analyticsQuery = $derived(getAnalytics({ period }));
	let _prev: typeof analyticsQuery.current;
	let data = $derived.by(() => {
		const val = analyticsQuery.current;
		if (val !== undefined) _prev = val;
		return val ?? _prev;
	});
	let chartMax = $derived(data ? Math.max(...data.pageviews.map((p: UmamiPageview) => p.y), 1) : 1);

	function formatDuration(seconds: number) {
		if (seconds < 60) return `${seconds}s`;
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}m ${s}s`;
	}

	function formatDate(timestamp: string, p: string) {
		const d = new Date(timestamp);
		if (p === '24h') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}

	type MetricRow = { x: string; y: number };

	const columnHelper = createColumnHelper<MetricRow>();

	function metricColumns(label: string, mono: boolean, emptyLabel?: string) {
		return [
			columnHelper.accessor('x', {
				header: label,
				cell: (info) => {
					const val = info.getValue() || emptyLabel || 'Unknown';
					return mono
						? renderSnippet(monoCell, val)
						: val;
				},
				enableColumnFilter: false,
			}),
			columnHelper.accessor('y', {
				header: 'Visitors',
				cell: (info) => renderSnippet(numCell, info.getValue()),
				enableColumnFilter: false,
			}),
		];
	}

	function createMetricTable(items: MetricRow[], label: string, mono: boolean, emptyLabel?: string) {
		return createSvelteTable({
			data: items,
			columns: metricColumns(label, mono, emptyLabel),
			getCoreRowModel: getCoreRowModel(),
		});
	}

	const sections = [
		{ title: 'Top Pages', key: 'pages' as const, label: 'Page', mono: true },
		{ title: 'Referrers', key: 'referrers' as const, label: 'Source', mono: true, emptyLabel: '(direct)' },
		{ title: 'Browsers', key: 'browsers' as const, label: 'Browser', mono: false },
		{ title: 'Operating Systems', key: 'os' as const, label: 'Operating System', mono: false },
		{ title: 'Devices', key: 'devices' as const, label: 'Device', mono: false },
		{ title: 'Countries', key: 'countries' as const, label: 'Country', mono: false },
	] as const;
</script>

{#snippet monoCell(value: string)}
	<span class="path">{value}</span>
{/snippet}

{#snippet numCell(value: number)}
	<span class="num">{value}</span>
{/snippet}

<div class="page-header">
	<h1>Analytics</h1>
	<div class="header-controls">
		{#if analyticsQuery.loading && data}
			<Spinner size={20} />
		{/if}
		<ToggleGroup bind:value={period} options={[
			{ value: '24h', label: '24h' },
			{ value: '7d', label: '7d' },
			{ value: '30d', label: '30d' },
		]} />
	</div>
</div>

{#if !data && analyticsQuery.loading}
	<Spinner size={48} centered />
{:else if analyticsQuery.error}
	<EmptyState message="Analytics unavailable. Umami may not be configured." />
{:else if data}
	<div class="stats-grid">
		<StatCard value={data.stats.pageviews.toLocaleString()} label="Pageviews" accent="var(--brand-olive)" />
		<StatCard value={data.stats.visitors.toLocaleString()} label="Visitors" accent="var(--brand-amber)" />
		<StatCard value={data.stats.visits.toLocaleString()} label="Visits" accent="var(--brand-orange)" />
		<StatCard value="{data.stats.bounceRate}%" label="Bounce Rate" accent="var(--brand-magenta)" />
		<StatCard value={formatDuration(data.stats.avgTime)} label="Avg. Visit" accent="var(--brand-brown-lighter)" />
		<StatCard value={data.active} label="Active Now" accent="var(--brand-olive)" />
	</div>

	{#if data.pageviews.length > 0}
		<section class="chart-section">
			<h2>Pageviews</h2>
			<Card>
				<div class="chart">
					<div class="chart-bars">
						{#each data.pageviews as point}
							<div class="chart-col">
								<div class="chart-tooltip">{point.y}</div>
								<div class="chart-bar" style="height: {(point.y / chartMax) * 100}%"></div>
								<span class="chart-label">{formatDate(point.x, period)}</span>
							</div>
						{/each}
					</div>
				</div>
			</Card>
		</section>
	{/if}

	<div class="metrics-grid">
		{#each sections as section}
			{@const items = data[section.key]}
			<Section title={section.title}>
				{#if items.length === 0}
					<EmptyState message="No {section.title.toLowerCase()} data yet." />
				{:else}
					{@const table = createMetricTable(items, section.label, section.mono, 'emptyLabel' in section ? section.emptyLabel : undefined)}
					<DataTable {table} pageSize={5} />
				{/if}
			</Section>
		{/each}
	</div>
{/if}

<style>
	.stats-grid {
		margin-bottom: 1.5rem;
	}

	.chart-section {
		margin-bottom: 1.5rem;
	}

	.stats-grid {
		margin-bottom: 1.5rem;
	}

	.chart-section {
		margin-bottom: 1.5rem;
	}

	.chart {
		padding: 0.5rem 0;
	}

	.chart-bars {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 180px;
	}

	.chart-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
		justify-content: flex-end;
		position: relative;
	}

	.chart-bar {
		width: 100%;
		min-height: 2px;
		background: var(--brand-olive);
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		transition: height 0.3s ease;
	}

	.chart-col:hover .chart-bar {
		background: var(--brand-olive-light);
	}

	.chart-tooltip {
		position: absolute;
		top: -1.5rem;
		font-size: 0.7rem;
		color: var(--color-muted);
		opacity: 0;
		transition: opacity 0.15s;
		pointer-events: none;
	}

	.chart-col:hover .chart-tooltip {
		opacity: 1;
	}

	.chart-label {
		font-size: 0.6rem;
		color: var(--color-muted);
		margin-top: 0.35rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	/* ─── Metrics Grid ─────────────────────────────────────────────────── */

	.metrics-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	@media (max-width: 768px) {
		.metrics-grid {
			grid-template-columns: 1fr;
		}
	}

	.path {
		display: block;
		max-width: 250px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: monospace;
		font-size: 0.8rem;
	}

	.num {
		font-weight: 600;
		color: var(--brand-amber-dark);
		white-space: nowrap;
		text-align: right;
	}

	.header-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
</style>
