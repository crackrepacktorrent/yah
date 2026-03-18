<script lang="ts">
	import { Button, Card, EmptyState, FormField, MultiSelect, Section, Spinner, DateRangePicker } from '$lib/components/admin';
	import { today, getLocalTimeZone, type DateValue } from '@internationalized/date';
	import { listCampaigns, getCampaignAnalytics } from '../campaigns.remote';

	// ─── Campaign multi-select ───────────────────────────────────
	let selectedCampaignIds = $state<string[]>([]);

	let campaignsQuery = $derived(listCampaigns());
	let _prevCampaigns: typeof campaignsQuery.current;
	let campaignsData = $derived.by(() => {
		const val = campaignsQuery.current;
		if (val !== undefined) _prevCampaigns = val;
		return val ?? _prevCampaigns;
	});

	let campaigns = $derived(campaignsData?.campaigns ?? []);
	let campaignOptions = $derived(
		campaigns.map((c) => ({ value: String(c.id), label: `#${c.id}: ${c.name}`, detail: c.status })),
	);

	// If nothing selected, use all campaign IDs
	let effectiveIds = $derived(
		selectedCampaignIds.length > 0
			? selectedCampaignIds.map(Number)
			: campaigns.map((c) => c.id),
	);

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
	let appliedIds = $state<number[]>([]);

	function applyFilters() {
		if (!dateRange.start || !dateRange.end) return;
		appliedFrom = formatDateValue(dateRange.start);
		appliedTo = formatDateValue(dateRange.end);
		appliedIds = effectiveIds;
	}

	// Auto-apply when campaigns load for the first time
	let hasAutoApplied = $state(false);
	$effect(() => {
		if (campaigns.length > 0 && !hasAutoApplied) {
			appliedIds = campaigns.map((c) => c.id);
			hasAutoApplied = true;
		}
	});

	let viewsQuery = $derived(
		appliedIds.length > 0
			? getCampaignAnalytics({
					campaignIds: appliedIds,
					type: 'views',
					from: appliedFrom,
					to: appliedTo,
				})
			: null,
	);
	let _prevViews: typeof viewsQuery extends null ? undefined : NonNullable<typeof viewsQuery>['current'];
	let viewsData = $derived.by(() => {
		if (!viewsQuery) return _prevViews;
		const val = viewsQuery.current;
		if (val !== undefined) _prevViews = val;
		return val ?? _prevViews;
	});

	let clicksQuery = $derived(
		appliedIds.length > 0
			? getCampaignAnalytics({
					campaignIds: appliedIds,
					type: 'clicks',
					from: appliedFrom,
					to: appliedTo,
				})
			: null,
	);
	let _prevClicks: typeof clicksQuery extends null ? undefined : NonNullable<typeof clicksQuery>['current'];
	let clicksData = $derived.by(() => {
		if (!clicksQuery) return _prevClicks;
		const val = clicksQuery.current;
		if (val !== undefined) _prevClicks = val;
		return val ?? _prevClicks;
	});

	let loading = $derived((viewsQuery?.loading || clicksQuery?.loading) ?? false);

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
</script>

<h1>Email Analytics</h1>

{#if !campaignsData && campaignsQuery.loading}
	<Spinner size={48} centered />
{:else}
	<div class="filter-bar">
		<div class="filter-campaigns">
			<FormField label="Campaigns">
				<MultiSelect
					bind:selected={selectedCampaignIds}
					options={campaignOptions}
					placeholder="All campaigns"
				/>
			</FormField>
		</div>

		<div class="filter-dates">
			<FormField label="Date range">
				<DateRangePicker bind:value={dateRange} maxValue={nowDate} />
			</FormField>
		</div>

		<div class="filter-apply">
			<Button variant="primary" onclick={applyFilters}>Apply</Button>
		</div>
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
		align-items: flex-end;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.filter-campaigns {
		flex: 1;
		min-width: 260px;
	}

	.filter-dates {
		flex-shrink: 0;
	}

	.filter-apply {
		padding-bottom: 0.125rem;
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

		.filter-campaigns {
			min-width: 0;
		}
	}
</style>
