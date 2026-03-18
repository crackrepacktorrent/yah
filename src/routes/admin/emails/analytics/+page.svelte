<script lang="ts">
	import { Badge, Button, Card, EmptyState, Section, Spinner } from '$lib/components/admin';
	import { Combobox, DateRangePicker } from 'bits-ui';
	import { today, getLocalTimeZone, type DateValue } from '@internationalized/date';
	import { listCampaigns, getCampaignAnalytics } from '../campaigns.remote';

	// ─── Campaign combobox ───────────────────────────────────────
	let selectedCampaignId = $state<number | undefined>(undefined);
	let comboboxOpen = $state(false);
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
	let appliedFrom = $state(formatDateValue(dateRange.start!));
	let appliedTo = $state(formatDateValue(dateRange.end!));
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
		<Combobox.Root
			type="single"
			value={selectedCampaignId != null ? String(selectedCampaignId) : ''}
			onValueChange={(v) => {
				selectedCampaignId = v ? Number(v) : undefined;
				searchValue = '';
			}}
			bind:open={comboboxOpen}
		>
			<div class="combobox-trigger-wrap">
				<Combobox.Input
					oninput={(e) => { searchValue = (e.target as HTMLInputElement).value; }}
					placeholder="Search campaigns..."
					defaultValue={selectedLabel}
				>
					{#snippet child({ props })}
						<input {...props} class="combobox-input" />
					{/snippet}
				</Combobox.Input>
				<Combobox.Trigger>
					{#snippet child({ props })}
						<button {...props} class="combobox-chevron" aria-label="Toggle campaign list">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="6 9 12 15 18 9"></polyline>
							</svg>
						</button>
					{/snippet}
				</Combobox.Trigger>
			</div>

			<Combobox.Content class="combobox-content" sideOffset={4}>
				<Combobox.Item value="" label="All campaigns" class="combobox-item">
					{#snippet child({ props: itemProps, selected: itemSelected })}
						<div {...itemProps} class="combobox-item" class:selected={itemSelected}>
							All campaigns
						</div>
					{/snippet}
				</Combobox.Item>
				{#each filteredCampaigns as campaign}
					<Combobox.Item value={String(campaign.id)} label="{campaign.name} ({campaign.status})" class="combobox-item">
						{#snippet child({ props: itemProps, selected: itemSelected })}
							<div {...itemProps} class="combobox-item" class:selected={itemSelected}>
								<span>{campaign.name}</span>
								<Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
							</div>
						{/snippet}
					</Combobox.Item>
				{/each}
				{#if filteredCampaigns.length === 0}
					<div class="combobox-empty">No campaigns found</div>
				{/if}
			</Combobox.Content>
		</Combobox.Root>

		<DateRangePicker.Root
			bind:value={dateRange}
			maxValue={nowDate}
			weekStartsOn={1}
		>
			<div class="date-range-trigger-wrap">
				<DateRangePicker.Input type="start">
					{#snippet child({ segments })}
						<div class="date-segments">
							{#each segments as seg}
								<DateRangePicker.Segment part={seg.part}>
									{#snippet child({ props })}
										<span {...props} class="date-segment" class:literal={seg.part === 'literal'}>
											{seg.value}
										</span>
									{/snippet}
								</DateRangePicker.Segment>
							{/each}
						</div>
					{/snippet}
				</DateRangePicker.Input>
				<span class="date-sep">–</span>
				<DateRangePicker.Input type="end">
					{#snippet child({ segments })}
						<div class="date-segments">
							{#each segments as seg}
								<DateRangePicker.Segment part={seg.part}>
									{#snippet child({ props })}
										<span {...props} class="date-segment" class:literal={seg.part === 'literal'}>
											{seg.value}
										</span>
									{/snippet}
								</DateRangePicker.Segment>
							{/each}
						</div>
					{/snippet}
				</DateRangePicker.Input>
				<DateRangePicker.Trigger>
					{#snippet child({ props })}
						<button {...props} class="date-trigger-btn" aria-label="Open calendar">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
								<line x1="16" y1="2" x2="16" y2="6"></line>
								<line x1="8" y1="2" x2="8" y2="6"></line>
								<line x1="3" y1="10" x2="21" y2="10"></line>
							</svg>
						</button>
					{/snippet}
				</DateRangePicker.Trigger>
			</div>

			<DateRangePicker.Content class="drp-content" sideOffset={6}>
				<DateRangePicker.Calendar>
					{#snippet child({ months, weekdays })}
						<div class="drp-calendar">
							<DateRangePicker.Header>
								{#snippet child({ props })}
									<div {...props} class="drp-header">
										<DateRangePicker.PrevButton>
											{#snippet child({ props: btnProps })}
												<button {...btnProps} class="drp-nav-btn">
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
												</button>
											{/snippet}
										</DateRangePicker.PrevButton>
										<DateRangePicker.Heading>
											{#snippet child({ props: headProps, headingValue })}
												<span {...headProps} class="drp-heading">{headingValue}</span>
											{/snippet}
										</DateRangePicker.Heading>
										<DateRangePicker.NextButton>
											{#snippet child({ props: btnProps })}
												<button {...btnProps} class="drp-nav-btn">
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
												</button>
											{/snippet}
										</DateRangePicker.NextButton>
									</div>
								{/snippet}
							</DateRangePicker.Header>
							{#each months as month}
								<DateRangePicker.Grid>
									<DateRangePicker.GridHead>
										<DateRangePicker.GridRow>
											{#each weekdays as day}
												<DateRangePicker.HeadCell>
													{#snippet child({ props })}
														<th {...props} class="drp-head-cell">{day}</th>
													{/snippet}
												</DateRangePicker.HeadCell>
											{/each}
										</DateRangePicker.GridRow>
									</DateRangePicker.GridHead>
									<DateRangePicker.GridBody>
										{#snippet child({ props })}
											<tbody {...props}>
												{#each month.weeks as week}
													<DateRangePicker.GridRow>
														{#each week as date}
															<DateRangePicker.Cell {date} month={month.value}>
																{#snippet child({ props: cellProps, disabled: cellDisabled })}
																	<td {...cellProps}>
																		<DateRangePicker.Day>
																			{#snippet child({ props: dayProps, selected: daySelected, disabled: dayDisabled })}
																				<button
																					{...dayProps}
																					class="drp-day"
																					class:selected={daySelected}
																					class:disabled={dayDisabled || cellDisabled}
																				>
																					{date.day}
																				</button>
																			{/snippet}
																		</DateRangePicker.Day>
																	</td>
																{/snippet}
															</DateRangePicker.Cell>
														{/each}
													</DateRangePicker.GridRow>
												{/each}
											</tbody>
										{/snippet}
									</DateRangePicker.GridBody>
								</DateRangePicker.Grid>
							{/each}
						</div>
					{/snippet}
				</DateRangePicker.Calendar>
			</DateRangePicker.Content>
		</DateRangePicker.Root>

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

	/* ─── Date Range Picker ───────────────────────────────────── */

	.date-range-trigger-wrap {
		display: flex;
		align-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		padding: 0.35rem 0.75rem;
		gap: 0.375rem;
	}

	.date-range-trigger-wrap:focus-within {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
	}

	.date-segments {
		display: flex;
		align-items: center;
	}

	.date-segment {
		padding: 0.15rem 0.125rem;
		font-size: 0.9rem;
		color: var(--color-foreground);
		border-radius: var(--radius-sm);
		outline: none;
		font-variant-numeric: tabular-nums;
	}

	.date-segment:focus {
		background: var(--color-primary);
		color: white;
	}

	.date-segment.literal {
		color: var(--color-muted);
		padding: 0;
	}

	.date-sep {
		color: var(--color-muted);
		font-size: 0.85rem;
		padding: 0 0.125rem;
	}

	.date-trigger-btn {
		background: none;
		border: none;
		padding: 0.25rem;
		color: var(--color-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		border-radius: var(--radius-sm);
	}

	.date-trigger-btn:hover {
		color: var(--color-foreground);
		background: var(--color-hover);
	}

	/* ─── Calendar popup ──────────────────────────────────────── */

	:global(.drp-content) {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		padding: 0.75rem;
		z-index: 52;
	}

	.drp-calendar {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.drp-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.25rem;
	}

	.drp-heading {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--color-foreground);
	}

	.drp-nav-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		color: var(--color-muted);
		display: flex;
		align-items: center;
	}

	.drp-nav-btn:hover {
		background: var(--color-hover);
		color: var(--color-foreground);
	}

	.drp-nav-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.drp-head-cell {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		padding: 0.25rem 0;
		text-align: center;
		width: 2.25rem;
	}

	.drp-day {
		width: 2.25rem;
		height: 2.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: none;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		color: var(--color-foreground);
		cursor: pointer;
	}

	.drp-day:hover:not(.disabled):not(.outside) {
		background: var(--color-hover);
	}

	.drp-day.selected {
		background: var(--color-primary);
		color: white;
		font-weight: 600;
	}

	.drp-day.highlighted:not(.selected) {
		background: color-mix(in srgb, var(--color-primary) 15%, transparent);
	}

	.drp-day.outside {
		color: var(--color-muted);
		opacity: 0.4;
	}

	.drp-day.disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* ─── Combobox ─────────────────────────────────────────────── */

	.combobox-trigger-wrap {
		display: flex;
		align-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		overflow: hidden;
		min-width: 260px;
	}

	.combobox-trigger-wrap:focus-within {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
	}

	.combobox-input {
		flex: 1;
		border: none;
		background: none;
		padding: 0.5rem 0.75rem;
		font-size: 0.9rem;
		color: var(--color-foreground);
		outline: none;
		min-width: 0;
	}

	.combobox-input::placeholder {
		color: var(--color-muted);
	}

	.combobox-chevron {
		background: none;
		border: none;
		padding: 0.5rem;
		color: var(--color-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
	}

	.combobox-chevron:hover {
		color: var(--color-foreground);
	}

	:global(.combobox-content) {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		padding: 0.25rem;
		max-height: 260px;
		overflow-y: auto;
		z-index: 52;
	}

	:global(.combobox-item) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.6rem;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		cursor: pointer;
		color: var(--color-foreground);
	}

	:global(.combobox-item:hover),
	:global(.combobox-item[data-highlighted]) {
		background: var(--color-hover);
	}

	:global(.combobox-item.selected) {
		font-weight: 600;
	}

	.combobox-empty {
		padding: 0.5rem 0.6rem;
		font-size: 0.85rem;
		color: var(--color-muted);
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

		.combobox-trigger-wrap {
			min-width: 0;
		}
	}
</style>
