<script lang="ts">
	import { Button, Card, EmptyState, FormField, MultiSelect, Section, DateRangePicker } from '$lib/components/admin';
	import BarChart from '$lib/components/admin/BarChart.svelte';
	import { today, getLocalTimeZone, type DateValue } from '@internationalized/date';
	import { listCampaigns, getCampaignAnalytics } from '../campaigns.remote';

	// ─── Campaign multi-select ───────────────────────────────────
	let selectedCampaignIds = $state<string[]>([]);

	let campaignsData = $derived(await listCampaigns());
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
	// Computed once per page load — stale if page stays open past midnight (acceptable)
	const nowDate = today(getLocalTimeZone());
	let dateRange = $state({ start: nowDate.subtract({ days: 7 }) as DateValue | undefined, end: nowDate as DateValue | undefined });

	function formatDateValue(d: DateValue): string {
		return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
	}

	// ─── Analytics queries ───────────────────────────────────────
	let appliedFrom = $state(formatDateValue(nowDate.subtract({ days: 7 })));
	let appliedTo = $state(formatDateValue(nowDate));
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

	// Analytics data — fetched in parallel, re-resolves when appliedIds/dates change
	let [viewsData, clicksData] = $derived(
		appliedIds.length > 0
			? await Promise.all([
					getCampaignAnalytics({ campaignIds: appliedIds, type: 'views', from: appliedFrom, to: appliedTo }),
					getCampaignAnalytics({ campaignIds: appliedIds, type: 'clicks', from: appliedFrom, to: appliedTo }),
				])
			: [null, null],
	);

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

	function formatDate(timestamp: string) {
		const d = new Date(timestamp);
		return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}
</script>

<h1>Email Analytics</h1>

{#if campaignsData}
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

	{#if viewsBars.length === 0 && clicksBars.length === 0}
		<EmptyState message="No analytics data for this date range." />
	{:else}
		<div class="section-stack">
			<Section title="Views ({viewsTotal.toLocaleString()})">
				<Card>
					{#if viewsBars.length === 0}
						<EmptyState message="No view data for this period." />
					{:else}
						<BarChart
							bars={viewsBars.map((p) => ({ x: p.timestamp, y: p.count }))}
							color="var(--brand-olive)"
							hoverColor="var(--brand-olive-light)"
							formatLabel={formatDate}
						/>
					{/if}
				</Card>
			</Section>

			<Section title="Clicks ({clicksTotal.toLocaleString()})">
				<Card>
					{#if clicksBars.length === 0}
						<EmptyState message="No click data for this period." />
					{:else}
						<BarChart
							bars={clicksBars.map((p) => ({ x: p.timestamp, y: p.count }))}
							color="var(--brand-amber)"
							hoverColor="var(--brand-amber-light)"
							formatLabel={formatDate}
						/>
					{/if}
				</Card>
			</Section>
		</div>
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
