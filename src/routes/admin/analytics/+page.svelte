<script lang="ts">
	import { StatCard, EmptyState, Card, DataTable, Section, ToggleGroup } from '$lib/components/admin';
	import BarChart from '$lib/components/admin/BarChart.svelte';
	import { createSvelteTable, renderSnippet } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel } from '@tanstack/table-core';
	import { getAnalytics } from '../analytics.remote';
	import { formatDuration } from '$lib/utils/admin';

	let period = $state<'24h' | '7d' | '30d'>('7d');
	let data = $derived(await getAnalytics({ period }));


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
		<ToggleGroup bind:value={period} options={[
			{ value: '24h', label: '24h' },
			{ value: '7d', label: '7d' },
			{ value: '30d', label: '30d' },
		]} />
	</div>
</div>

{#if data}
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
				<BarChart
					bars={data.pageviews.map((p) => ({ x: p.x, y: p.y }))}
					color="var(--brand-olive)"
					hoverColor="var(--brand-olive-light)"
					formatLabel={(x) => formatDate(x, period)}
				/>
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
