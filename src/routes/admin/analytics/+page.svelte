<script lang="ts">
	import { StatCard, EmptyState, Spinner, Card, Section } from '$lib/components/admin';
	import { ToggleGroup } from 'bits-ui';
	import { getAnalytics } from '../analytics.remote';

	let period = $state<'24h' | '7d' | '30d'>('7d');
	let analyticsQuery = $derived(getAnalytics({ period }));
	let data = $derived(analyticsQuery.current);
	let chartMax = $derived(data ? Math.max(...data.pageviews.map((p: any) => p.y), 1) : 1);

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
</script>

<div class="header">
	<h1>Analytics</h1>
	<ToggleGroup.Root
		type="single"
		value={period}
		onValueChange={(v) => { if (v) period = v as typeof period; }}
	>
		{#snippet child({ props })}
			<div {...props} class="period-tabs">
				<ToggleGroup.Item value="24h">
					{#snippet child({ props: itemProps })}
						<button {...itemProps} class="period-tab" class:active={period === '24h'}>24h</button>
					{/snippet}
				</ToggleGroup.Item>
				<ToggleGroup.Item value="7d">
					{#snippet child({ props: itemProps })}
						<button {...itemProps} class="period-tab" class:active={period === '7d'}>7d</button>
					{/snippet}
				</ToggleGroup.Item>
				<ToggleGroup.Item value="30d">
					{#snippet child({ props: itemProps })}
						<button {...itemProps} class="period-tab" class:active={period === '30d'}>30d</button>
					{/snippet}
				</ToggleGroup.Item>
			</div>
		{/snippet}
	</ToggleGroup.Root>
</div>

{#if !data && analyticsQuery.loading}
	<Spinner size={48} centered />
{:else if data === null}
	<EmptyState message="Analytics not configured. Set UMAMI env vars to enable." />
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
		{#each [
			{ title: 'Top Pages', items: data.pages, fallback: 'No page data yet.', mono: true },
			{ title: 'Referrers', items: data.referrers, fallback: 'No referrer data yet.', mono: true, emptyLabel: '(direct)' },
			{ title: 'Browsers', items: data.browsers, fallback: 'No browser data yet.' },
			{ title: 'Operating Systems', items: data.os, fallback: 'No OS data yet.' },
			{ title: 'Devices', items: data.devices, fallback: 'No device data yet.' },
			{ title: 'Countries', items: data.countries, fallback: 'No country data yet.' },
		] as section}
			<div class="metric-section">
				<h3>{section.title}</h3>
				{#if section.items.length === 0}
					<EmptyState message={section.fallback} />
				{:else}
					<Card>
						<table class="metric-table">
							<thead>
								<tr>
									<th>{section.title === 'Top Pages' ? 'Page' : section.title === 'Referrers' ? 'Source' : section.title.replace(/s$/, '')}</th>
									<th class="num">Visitors</th>
								</tr>
							</thead>
							<tbody>
								{#each section.items as row}
									<tr>
										<td class:path={section.mono}>{row.x || section.emptyLabel || 'Unknown'}</td>
										<td class="num">{row.y}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</Card>
				{/if}
			</div>
		{/each}
	</div>
{/if}

{#if analyticsQuery.loading && data}
	<div class="loading-overlay">
		<Spinner size={32} />
	</div>
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

	h2 {
		font-size: 1.1rem;
		margin: 0 0 0.75rem;
		color: var(--color-foreground);
	}

	.period-tabs {
		display: flex;
		gap: 2px;
		background: var(--color-border);
		border-radius: var(--radius-md);
		padding: 2px;
	}

	.period-tab {
		background: none;
		border: none;
		padding: 0.35rem 0.75rem;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--color-muted);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.15s;
	}

	.period-tab.active {
		background: var(--color-surface);
		color: var(--color-foreground);
		box-shadow: var(--shadow-sm);
	}

	.period-tab:hover:not(.active) {
		color: var(--color-foreground);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	/* ─── Chart ────────────────────────────────────────────────────────── */

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

	.metric-section h3 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.5rem;
		color: var(--color-foreground);
	}

	.metric-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.metric-table th {
		text-align: left;
		font-weight: 600;
		color: var(--color-muted);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--color-border);
	}

	.metric-table td {
		padding: 0.45rem 0.75rem;
		border-bottom: 1px solid var(--color-border-light, var(--color-border));
		color: var(--color-foreground);
	}

	.metric-table tr:last-child td {
		border-bottom: none;
	}

	.metric-table .num {
		text-align: right;
		font-weight: 600;
		color: var(--brand-amber-dark);
		white-space: nowrap;
	}

	.metric-table .path {
		max-width: 250px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: monospace;
		font-size: 0.8rem;
	}

	/* ─── Loading overlay ──────────────────────────────────────────────── */

	.loading-overlay {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 10;
	}
</style>
