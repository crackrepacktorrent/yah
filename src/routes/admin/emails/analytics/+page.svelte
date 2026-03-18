<script lang="ts">
	import { Badge, Button, Card, EmptyState, Section, Spinner, Combobox, DateRangePicker } from '$lib/components/admin';
	import { Combobox as BitsCombobox } from 'bits-ui';
	import { today, getLocalTimeZone, type DateValue } from '@internationalized/date';
	import { listCampaigns, getCampaignAnalytics } from '../campaigns.remote';

	// ─── Campaign combobox ───────────────────────────────────────
	let selectedCampaignId = $state<number | undefined>(undefined);
	let searchValue = $state('');

	let campaignsQuery = $derived(listCampaigns());
	let _prevCampaigns: typeof campaignsQuery.current;
	let campaignsData = $derived.by(() => {
		const val = campaignsQuery.current;
		if (val !== undefined) _prevCampaigns = val;
		return val ?? _prevCampaigns;
	});

	let campaigns = $derived(campaignsData?.campaigns ?? []);
	let filteredCampaigns = $derived(
		searchValue
			? campaigns.filter((c) => c.name.toLowerCase().includes(searchValue.toLowerCase()))
			: campaigns,
	);

	let selected = $derived(
		selectedCampaignId != null ? campaigns.find((c) => c.id === selectedCampaignId) : null,
	);
	let selectedLabel = $derived(selected ? `${selected.name} (${selected.status})` : 'All campaigns');

	// ─── Date range ──────────────────────────────────────────────
	let nowDate = today(getLocalTimeZone());
	let dateRange = $state({ start: nowDate.subtract({ days: 7 }) as DateValue | undefined, end: nowDate as DateValue | undefined });

	function formatDateValue(d: DateValue): string {
		return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
	}

	// ─── Analytics queries ───────────────────────────────────────
	let initialFrom = formatDateValue(nowDate.subtract({ days: 7 }));
	let initialTo = formatDateValue(nowDate);
	let appliedFrom = $state(initialFrom);
	let appliedTo = $state(initialTo);
	let appliedCampaignId = $state<number | undefined>(undefined);

	function applyFilters() {
		if (!dateRange.start || !dateRange.end) return;
		appliedFrom = formatDateValue(dateRange.start);
		appliedTo = formatDateValue(dateRange.end);
		appliedCampaignId = selectedCampaignId;
	}

	let viewsQuery = $derived(
		getCampaignAnalytics({
			campaignId: appliedCampaignId,
			type: 'views',
			from: appliedFrom,
			to: appliedTo,
		}),
	);
	let _prevViews: typeof viewsQuery.current;
	let viewsData = $derived.by(() => {
		const val = viewsQuery.current;
		if (val !== undefined) _prevViews = val;
		return val ?? _prevViews;
	});

	let clicksQuery = $derived(
		getCampaignAnalytics({
			campaignId: appliedCampaignId,
			type: 'clicks',
			from: appliedFrom,
			to: appliedTo,
		}),
	);
	let _prevClicks: typeof clicksQuery.current;
	let clicksData = $derived.by(() => {
		const val = clicksQuery.current;
		if (val !== undefined) _prevClicks = val;
		return val ?? _prevClicks;
	});

	let loading = $derived(viewsQuery.loading || clicksQuery.loading);

	// ─── Chart helpers ───────────────────────────────────────────
	type AnalyticsPoint = { campaign_id: number; count: number; timestamp: string };

	function aggregateByTimestamp(points: AnalyticsPoint[]): { timestamp: string; count: number }[] {
		const map = new Map<string, number>();
		for (const p of points) {
			map.set(p.timestamp, (map.get(p.timestamp) ?? 0) + p.count);
		}
		return Array.from(map.entries())
			.map(([timestamp, count]) => ({ timestamp, count }))
			.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
	}

	let viewsBars = $derived(viewsData ? aggregateByTimestamp(viewsData) : []);
	let clicksBars = $derived(clicksData ? aggregateByTimestamp(clicksData) : []);

	let viewsTotal = $derived(viewsBars.reduce((s, p) => s + p.count, 0));
	let clicksTotal = $derived(clicksBars.reduce((s, p) => s + p.count, 0));

	function chartMax(bars: { count: number }[]): number {
		return Math.max(...bars.map((b) => b.count), 1);
	}

	function formatDate(timestamp: string) {
		const d = new Date(timestamp);
		return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}

	function statusVariant(status: string): 'default' | 'success' | 'error' | 'warning' | 'info' {
		switch (status) {
			case 'draft': return 'default';
			case 'running': return 'success';
			case 'paused': return 'warning';
			case 'finished': return 'info';
			case 'cancelled': return 'error';
			case 'scheduled': return 'warning';
			default: return 'default';
		}
	}
</script>

<h1>Email Analytics</h1>

{#if !campaignsData && campaignsQuery.loading}
	<Spinner size={48} centered />
{:else}
	<div class="filter-bar">
		<Combobox
			value={selectedCampaignId != null ? String(selectedCampaignId) : ''}
			onValueChange={(v) => {
				selectedCampaignId = v ? Number(v) : undefined;
				searchValue = '';
			}}
			oninput={(e) => { searchValue = (e.target as HTMLInputElement).value; }}
			placeholder="Search campaigns..."
			class="combobox-campaigns"
		>
			<BitsCombobox.Item value="" label="All campaigns" class="combobox-item">
				{#snippet child({ props: itemProps, selected: itemSelected })}
					<div {...itemProps} class="combobox-item" class:selected={itemSelected}>
						All campaigns
					</div>
				{/snippet}
			</BitsCombobox.Item>
			{#each filteredCampaigns as campaign}
				<BitsCombobox.Item value={String(campaign.id)} label="{campaign.name} ({campaign.status})" class="combobox-item">
					{#snippet child({ props: itemProps, selected: itemSelected })}
						<div {...itemProps} class="combobox-item" class:selected={itemSelected}>
							<span>{campaign.name}</span>
							<Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
						</div>
					{/snippet}
				</BitsCombobox.Item>
			{/each}
			{#if filteredCampaigns.length === 0}
				<div class="combobox-empty">No campaigns found</div>
			{/if}
		</Combobox>

		<DateRangePicker bind:value={dateRange} maxValue={nowDate} />

		<Button variant="primary" onclick={applyFilters}>Apply</Button>
	</div>

	{#if loading && !viewsData && !clicksData}
		<Spinner size={48} centered />
	{:else}
		{#if viewsBars.length === 0 && clicksBars.length === 0}
			<EmptyState message="No analytics data for this date range." />
		{:else}
			{#if loading}
				<div class="loading-overlay">
					<Spinner size={32} />
				</div>
			{/if}

			<Section title="Views ({viewsTotal.toLocaleString()})">
				<Card>
					{#if viewsBars.length === 0}
						<EmptyState message="No view data for this period." />
					{:else}
						<div class="chart">
							<div class="chart-bars">
								{#each viewsBars as point}
									<div class="chart-col">
										<div class="chart-tooltip">{point.count}</div>
										<div class="chart-bar views" style="height: {(point.count / chartMax(viewsBars)) * 100}%"></div>
										<span class="chart-label">{formatDate(point.timestamp)}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</Card>
			</Section>

			<Section title="Clicks ({clicksTotal.toLocaleString()})">
				<Card>
					{#if clicksBars.length === 0}
						<EmptyState message="No click data for this period." />
					{:else}
						<div class="chart">
							<div class="chart-bars">
								{#each clicksBars as point}
									<div class="chart-col">
										<div class="chart-tooltip">{point.count}</div>
										<div class="chart-bar clicks" style="height: {(point.count / chartMax(clicksBars)) * 100}%"></div>
										<span class="chart-label">{formatDate(point.timestamp)}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</Card>
			</Section>
		{/if}
	{/if}
{/if}

<style>
	/* ─── Filter bar ──────────────────────────────────────────── */

	.filter-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	:global(.combobox-campaigns) {
		min-width: 260px;
	}

	/* ─── Charts ──────────────────────────────────────────────── */

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
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		transition: height 0.3s ease;
	}

	.chart-bar.views {
		background: var(--brand-olive);
	}

	.chart-col:hover .chart-bar.views {
		background: var(--brand-olive-light);
	}

	.chart-bar.clicks {
		background: var(--brand-amber);
	}

	.chart-col:hover .chart-bar.clicks {
		background: var(--brand-amber-light, var(--brand-amber));
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

	/* ─── Loading overlay ─────────────────────────────────────── */

	.loading-overlay {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 10;
	}

	@media (max-width: 640px) {
		.filter-bar {
			flex-direction: column;
			align-items: stretch;
		}

		:global(.combobox-campaigns) {
			min-width: 0;
		}
	}
</style>
