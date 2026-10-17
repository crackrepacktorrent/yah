import { revalidate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Errored, For, Loading, Show, createMemo, createSignal, isPending, latest } from 'solid-js';
import { ANALYTICS_PERIODS, type AnalyticsMetric, type AnalyticsPeriod, type AnalyticsSnapshot } from '~/features/analytics/contracts';
import { getAnalytics } from '~/features/analytics/server';
import { formatDuration } from '~/features/analytics/presentation';
import { TimeSeriesChart } from '~/ui/time-series-chart';
import './index.css';

export const route = defineFileRoute('/analytics', {
	preload: () => void getAnalytics('7d'),
});

const periodLabels: Record<AnalyticsPeriod, string> = {
	'24h': '24 hours',
	'7d': '7 days',
	'30d': '30 days',
};

const metricSections = [
	{ title: 'Top Pages', key: 'pages' as const, column: 'Page', code: true, emptyLabel: 'Unknown' },
	{ title: 'Referrers', key: 'referrers' as const, column: 'Source', code: true, emptyLabel: '(direct)' },
	{ title: 'Browsers', key: 'browsers' as const, column: 'Browser', code: false, emptyLabel: 'Unknown' },
	{ title: 'Operating Systems', key: 'operatingSystems' as const, column: 'Operating system', code: false, emptyLabel: 'Unknown' },
	{ title: 'Devices', key: 'devices' as const, column: 'Device', code: false, emptyLabel: 'Unknown' },
] as const;

export default function AnalyticsPage() {
	const [period, setPeriod] = createSignal<AnalyticsPeriod>('7d');
	const snapshot = createMemo(() => getAnalytics(period()));
	const visibleSnapshot = createMemo(() => latest(snapshot));
	const updating = createMemo(() => isPending(snapshot));

	return (
		<section class="analytics-page">
			<header class="analytics-header">
				<div>
					<p class="eyebrow">Audience</p>
					<h1>Analytics</h1>
				</div>
				<fieldset class="period-picker">
					<legend class="visually-hidden">Reporting period</legend>
					<For each={ANALYTICS_PERIODS}>
						{(option) => (
							<label>
								<input
									type="radio"
									name="analytics-period"
									value={option}
									checked={period() === option}
									onInput={() => setPeriod(option)}
								/>
								<span>{option}</span>
							</label>
						)}
					</For>
				</fieldset>
			</header>

			<Errored fallback={(_error, reset) => <div class="analytics-error" role="alert"><p>Analytics for this period could not be loaded.</p><button class="button button--secondary" type="button" onClick={() => { revalidate(getAnalytics.keyFor(period()), true); reset(); }}>Try again</button></div>}>
				<Loading fallback={<p class="analytics-status" role="status">Loading analytics…</p>}>
					<div class="analytics-result-slot" aria-busy={updating() ? 'true' : undefined}>
						<Show when={updating()}><p class="visually-hidden" role="status">Updating analytics…</p></Show>
						<Show when={visibleSnapshot()}>{(data) => <AnalyticsSnapshotView snapshot={data()} />}</Show>
					</div>
				</Loading>
			</Errored>
		</section>
	);
}

function AnalyticsSnapshotView(props: { snapshot: AnalyticsSnapshot }) {
	const points = createMemo(() => props.snapshot.pageviews.map(({ timestamp, pageviews }) => ({ timestamp, value: pageviews })));
	const stats = createMemo(() => [
		{ label: 'Pageviews', value: props.snapshot.stats.pageviews.toLocaleString() },
		{ label: 'Visitors', value: props.snapshot.stats.visitors.toLocaleString() },
		{ label: 'Visits', value: props.snapshot.stats.visits.toLocaleString() },
		{ label: 'Bounce rate', value: `${props.snapshot.stats.bounceRate}%` },
		{ label: 'Average visit', value: formatDuration(props.snapshot.stats.averageVisitSeconds) },
		{ label: 'Active now', value: props.snapshot.activeVisitors.toLocaleString() },
	]);

	return (
		<div class="analytics-results">
			<p class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
				Showing analytics for the last {periodLabels[props.snapshot.period]}.
			</p>
			<dl class="analytics-stats">
				<For each={stats()}>
					{(stat) => (
						<div class="analytics-stat">
							<dt>{stat.label}</dt>
							<dd>{stat.value}</dd>
						</div>
					)}
				</For>
			</dl>

			<TimeSeriesChart class="pageview-figure"
				caption={`Pageviews over the last ${periodLabels[props.snapshot.period]}`}
				metric="Pageviews" points={points()} interval={props.snapshot.period === '24h' ? 'hour' : 'day'} range={props.snapshot.range}
				emptyMessage="No pageviews were recorded in this period." />

			<section class="analytics-section" aria-labelledby="geographic-reach">
				<h2 id="geographic-reach">Geographic Reach</h2>
				<MetricBars items={props.snapshot.cities} emptyMessage="No city data yet." />
			</section>

			<div class="analytics-tables">
				<For each={metricSections}>
					{(section) => (
						<MetricTable
							title={section.title}
							column={section.column}
							items={props.snapshot[section.key]}
							code={section.code}
							emptyLabel={section.emptyLabel}
						/>
					)}
				</For>
			</div>
		</div>
	);
}

function MetricBars(props: { items: AnalyticsMetric[]; emptyMessage: string }) {
	const normalized = createMemo(() => {
		const known = props.items.filter(({ label }) => label).map((item) => ({ ...item }));
		const unknown = props.items.filter(({ label }) => !label).reduce((total, item) => total + item.visitors, 0);
		if (unknown > 0) known.push({ label: '(unknown)', visitors: unknown });
		return known;
	});
	const maximum = createMemo(() => Math.max(1, ...normalized().map(({ visitors }) => visitors)));

	return (
		<Show when={normalized().length > 0} fallback={<p class="analytics-empty">{props.emptyMessage}</p>}>
			<ul class="metric-bars">
				<For each={normalized()}>
					{(item) => (
						<li>
							<span>{item.label}</span>
							<strong>{item.visitors.toLocaleString()}</strong>
							<span class="metric-track" aria-hidden="true">
								<span style={{ width: `${(item.visitors / maximum()) * 100}%` }} />
							</span>
						</li>
					)}
				</For>
			</ul>
		</Show>
	);
}

function MetricTable(props: {
	title: string;
	column: string;
	items: AnalyticsMetric[];
	code: boolean;
	emptyLabel: string;
}) {
	return (
		<div class="metric-table-card">
			<table>
				<caption>{props.title}</caption>
				<thead>
					<tr>
						<th scope="col">{props.column}</th>
						<th scope="col">Visitors</th>
					</tr>
				</thead>
				<tbody>
					<Show
						when={props.items.length > 0}
						fallback={
							<tr>
								<td colspan="2">No {props.title.toLowerCase()} data yet.</td>
							</tr>
						}
					>
						<For each={props.items}>
							{(item) => (
								<tr>
									<td>{props.code ? <code>{item.label || props.emptyLabel}</code> : item.label || props.emptyLabel}</td>
									<td>{item.visitors.toLocaleString()}</td>
								</tr>
							)}
						</For>
					</Show>
				</tbody>
			</table>
		</div>
	);
}
