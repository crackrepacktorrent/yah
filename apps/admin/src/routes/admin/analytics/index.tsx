import { createAsync, type RouteDefinition } from '@solidjs/router';
import { For, Show, createSignal } from 'solid-js';
import { createSolidTable, getCoreRowModel, createColumnHelper } from '@tanstack/solid-table';
import {
	BarChart, Card, DataTable, PageHeader, Section, StatCard, ToggleGroup,
} from '~/components';
import { formatDuration } from '~/lib/utils';
import { getAnalytics } from '../analytics.server';
import type { UmamiMetric } from '~/server/umami';
import './index.css';

export const route: RouteDefinition = {
	preload: () => { void getAnalytics('7d'); },
};

type Period = '24h' | '7d' | '30d';

const metricColumnHelper = createColumnHelper<UmamiMetric>();

const metricSections = [
	{ title: 'Top Pages', key: 'pages' as const, label: 'Page', mono: true },
	{ title: 'Referrers', key: 'referrers' as const, label: 'Source', mono: true, emptyLabel: '(direct)' },
	{ title: 'Browsers', key: 'browsers' as const, label: 'Browser', mono: false },
	{ title: 'Operating Systems', key: 'os' as const, label: 'OS', mono: false },
	{ title: 'Devices', key: 'devices' as const, label: 'Device', mono: false },
	{ title: 'Countries', key: 'countries' as const, label: 'Country', mono: false },
] as const;

export default function AnalyticsPage() {
	const [period, setPeriod] = createSignal<Period>('7d');
	const data = createAsync(() => getAnalytics(period()));

	function formatDate(timestamp: string) {
		const d = new Date(timestamp);
		return period() === '24h'
			? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			: d.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}

	return (
		<>
			<PageHeader title="Analytics">
				<ToggleGroup
					value={period()}
					onValueChange={(v) => setPeriod(v as Period)}
					options={[
						{ value: '24h', label: '24h' },
						{ value: '7d', label: '7d' },
						{ value: '30d', label: '30d' },
					]}
				/>
			</PageHeader>

			<Show when={data()}>
				{(d) => (
					<>
						<div class="stats-grid" style={{ 'margin-bottom': '1.5rem' }}>
							<StatCard value={d().stats.pageviews.toLocaleString()} label="Pageviews" accent="var(--brand-olive)" />
							<StatCard value={d().stats.visitors.toLocaleString()} label="Visitors" accent="var(--brand-amber)" />
							<StatCard value={d().stats.visits.toLocaleString()} label="Visits" accent="var(--brand-orange)" />
							<StatCard value={`${d().stats.bounceRate}%`} label="Bounce Rate" accent="var(--brand-magenta)" />
							<StatCard value={formatDuration(d().stats.avgTime)} label="Avg. Visit" accent="var(--brand-brown-lighter)" />
							<StatCard value={d().active} label="Active Now" accent="var(--brand-olive)" />
						</div>

						<Show when={d().pageviews.length > 0}>
							<section class="chart-section">
								<h2>Pageviews</h2>
								<Card>
									<BarChart
										bars={d().pageviews.map((p) => ({ x: p.x, y: p.y }))}
										color="var(--brand-olive)"
										hoverColor="var(--brand-olive-light)"
										formatLabel={(x) => formatDate(x)}
									/>
								</Card>
							</section>
						</Show>

						<div class="metrics-grid">
							<For each={metricSections}>
								{(section) => (
									<MetricSection
										title={section.title}
										items={d()[section.key]}
										label={section.label}
										mono={section.mono}
										emptyLabel={'emptyLabel' in section ? section.emptyLabel : undefined}
									/>
								)}
							</For>
						</div>
					</>
				)}
			</Show>
		</>
	);
}

function MetricSection(props: {
	title: string;
	items: UmamiMetric[];
	label: string;
	mono: boolean;
	emptyLabel?: string;
}) {
	const columns = [
		metricColumnHelper.accessor('x', {
			get header() { return props.label; },
			cell: (info) => {
				const val = info.getValue() || props.emptyLabel || 'Unknown';
				return <Show when={props.mono} fallback={<>{val}</>}><span class="metric-path">{val}</span></Show>;
			},
			enableSorting: false,
		}),
		metricColumnHelper.accessor('y', {
			header: 'Visitors',
			cell: (info) => <span class="metric-num">{info.getValue()}</span>,
			enableSorting: false,
		}),
	];

	const table = createSolidTable({
		get data() { return props.items; },
		columns,
		getCoreRowModel: getCoreRowModel(),
		enableColumnFilters: false,
	});

	return (
		<Section title={props.title}>
			<DataTable table={table} emptyMessage={`No ${props.title.toLowerCase()} data yet.`} />
		</Section>
	);
}
