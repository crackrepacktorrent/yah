import { createAsync, type RouteDefinition } from '@solidjs/router';
import { Show, createEffect, createMemo, createSignal } from 'solid-js';
import {
	BarChart, Button, Card, DatePicker, EmptyState, FormField, PageHeader, Section, Spinner,
} from '~/components/admin';
import { MultiSelect } from '~/components/admin';
import { listCampaigns, getCampaignAnalytics } from '../campaigns.server';
import './index.css';

export const route: RouteDefinition = {
	preload: () => {
		void listCampaigns();
	},
};

type AnalyticsPoint = { campaign_id: number; count: number; timestamp: string };

function aggregateByTimestamp(points: AnalyticsPoint[]): { x: string; y: number }[] {
	const map = new Map<string, number>();
	for (const p of points) {
		map.set(p.timestamp, (map.get(p.timestamp) ?? 0) + p.count);
	}
	return Array.from(map.entries())
		.map(([x, y]) => ({ x, y }))
		.sort((a, b) => a.x.localeCompare(b.x));
}

function formatDate(timestamp: string) {
	const d = new Date(timestamp);
	return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function todayStr() {
	return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number) {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d.toISOString().slice(0, 10);
}

export default function EmailAnalyticsPage() {
	const campaignsQuery = createAsync(() => listCampaigns());

	const [selectedCampaignIds, setSelectedCampaignIds] = createSignal<string[]>([]);
	const [fromDate, setFromDate] = createSignal(daysAgoStr(7));
	const [toDate, setToDate] = createSignal(todayStr());

	// Applied state — only changes when user clicks Apply
	const [appliedIds, setAppliedIds] = createSignal<number[]>([]);
	const [appliedFrom, setAppliedFrom] = createSignal(daysAgoStr(7));
	const [appliedTo, setAppliedTo] = createSignal(todayStr());
	const [applied, setApplied] = createSignal(false);

	const campaigns = createMemo(() => campaignsQuery()?.campaigns ?? []);

	const campaignOptions = createMemo(() =>
		campaigns().map((c) => ({
			value: String(c.id),
			label: `#${c.id}: ${c.name}`,
			detail: c.status,
		})),
	);

	const effectiveIds = createMemo(() =>
		selectedCampaignIds().length > 0
			? selectedCampaignIds().map(Number)
			: campaigns().map((c) => c.id),
	);

	function applyFilters() {
		if (!fromDate() || !toDate()) return;
		const ids = effectiveIds();
		if (ids.length === 0) return;
		setAppliedIds(ids);
		setAppliedFrom(fromDate());
		setAppliedTo(toDate());
		setApplied(true);
	}

	// Auto-apply once campaigns load
	createEffect(() => {
		const cs = campaigns();
		if (cs.length > 0 && !applied()) {
			setAppliedIds(cs.map((c) => c.id));
			setApplied(true);
		}
	});

	const viewsQuery = createAsync(() =>
		appliedIds().length > 0
			? getCampaignAnalytics({ campaignIds: appliedIds(), type: 'views', from: appliedFrom(), to: appliedTo() })
			: Promise.resolve(null),
	) as () => AnalyticsPoint[] | null | undefined;

	const clicksQuery = createAsync(() =>
		appliedIds().length > 0
			? getCampaignAnalytics({ campaignIds: appliedIds(), type: 'clicks', from: appliedFrom(), to: appliedTo() })
			: Promise.resolve(null),
	) as () => AnalyticsPoint[] | null | undefined;

	const viewsBars = createMemo(() => (viewsQuery() ? aggregateByTimestamp(viewsQuery()!) : []));
	const clicksBars = createMemo(() => (clicksQuery() ? aggregateByTimestamp(clicksQuery()!) : []));

	const viewsTotal = createMemo(() => viewsBars().reduce((s, p) => s + p.y, 0));
	const clicksTotal = createMemo(() => clicksBars().reduce((s, p) => s + p.y, 0));

	const analyticsReady = createMemo(() => viewsQuery() !== undefined && clicksQuery() !== undefined);

	return (
		<>
			<PageHeader title="Email Analytics" />

			<Show when={campaignsQuery()}>
				<div class="filter-bar">
					<div class="filter-campaigns">
						<FormField label="Campaigns">
							<MultiSelect
								selected={selectedCampaignIds()}
								onChange={setSelectedCampaignIds}
								options={campaignOptions()}
								placeholder="All campaigns"
							/>
						</FormField>
					</div>

					<div class="filter-dates">
						<FormField label="From">
							<DatePicker value={fromDate()} onChange={setFromDate} />
						</FormField>
					</div>

					<div class="filter-dates">
						<FormField label="To">
							<DatePicker value={toDate()} onChange={setToDate} />
						</FormField>
					</div>

					<div class="filter-apply">
						<Button onClick={applyFilters}>Apply</Button>
					</div>
				</div>

				<Show when={!analyticsReady()} fallback={
					<Show
						when={viewsBars().length > 0 || clicksBars().length > 0}
						fallback={<EmptyState message="No analytics data for this date range." />}
					>
						<div class="section-stack">
							<Section title={`Views (${viewsTotal().toLocaleString()})`}>
								<Card>
									<Show
										when={viewsBars().length > 0}
										fallback={<EmptyState message="No view data for this period." />}
									>
										<BarChart
											bars={viewsBars()}
											color="var(--brand-olive)"
											hoverColor="var(--brand-olive-light)"
											formatLabel={formatDate}
										/>
									</Show>
								</Card>
							</Section>

							<Section title={`Clicks (${clicksTotal().toLocaleString()})`}>
								<Card>
									<Show
										when={clicksBars().length > 0}
										fallback={<EmptyState message="No click data for this period." />}
									>
										<BarChart
											bars={clicksBars()}
											color="var(--brand-amber)"
											hoverColor="var(--brand-amber-light)"
											formatLabel={formatDate}
										/>
									</Show>
								</Card>
							</Section>
						</div>
					</Show>
				}>
					<Spinner centered />
				</Show>
			</Show>
		</>
	);
}
