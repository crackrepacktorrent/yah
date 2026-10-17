import { LineChart, type LineSeriesOption } from 'echarts/charts';
import { GridComponent, TooltipComponent, type GridComponentOption, type TooltipComponentOption } from 'echarts/components';
import { init, use, type ComposeOption, type EChartsType } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { For, Show, createEffect, createMemo, createUniqueId, onCleanup } from 'solid-js';
import './time-series-chart.css';

use([LineChart, GridComponent, TooltipComponent, SVGRenderer]);

type LineOptions = ComposeOption<LineSeriesOption | GridComponentOption | TooltipComponentOption>;

export type TimeSeriesPoint = { timestamp: string; value: number };

export type TimeSeriesChartProps = {
	caption: string;
	metric: string;
	points: readonly TimeSeriesPoint[];
	interval: 'hour' | 'day';
	range: { startAt: number; endAt: number };
	emptyMessage: string;
	class?: string;
};

/** One chart lifecycle and accessible data view for both analytics providers. */
export function TimeSeriesChart(props: TimeSeriesChartProps) {
	const id = createUniqueId();
	const bucketSize = createMemo(() => (props.interval === 'hour' ? 1 : 24) * 60 * 60 * 1000);
	const startAt = createMemo(() => Math.floor(props.range.startAt / bucketSize()) * bucketSize());
	const points = createMemo(() => {
		if (props.points.length === 0) return [];
		const size = bucketSize();
		const start = startAt();
		const counts = new Map<number, number>();
		for (const point of props.points) {
			const bucket = Math.floor(Date.parse(point.timestamp) / size) * size;
			counts.set(bucket, (counts.get(bucket) ?? 0) + point.value);
		}
		// These providers omit buckets with no events. Fill the requested UTC
		// range so a line cannot bridge a quiet hour/day and imply activity.
		return Array.from({ length: Math.floor((props.range.endAt - start) / size) + 1 }, (_, index) => {
			const bucket = start + index * size;
			return { timestamp: new Date(bucket).toISOString(), value: counts.get(bucket) ?? 0 };
		});
	});
	const dateFormat = createMemo(() => new Intl.DateTimeFormat('en-US', {
		timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric',
		...(props.interval === 'hour' ? { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' as const } : {}),
	}));

	return (
		<figure class={['time-series-chart', props.class]} aria-labelledby={`${id}-caption`}>
			<figcaption id={`${id}-caption`}>{props.caption}</figcaption>
			<Show when={points().length > 0} fallback={<p class="time-series-chart-empty">{props.emptyMessage}</p>}>
				<p class="time-series-chart-note" id={`${id}-description`}>Times are UTC. Hours or days with no events are shown as zero; the first and last intervals may be partial. Open “View data” for exact values.</p>
				<TimeSeriesPlot points={points()} metric={props.metric} includeTime={props.interval === 'hour'} startAt={startAt()} endAt={props.range.endAt}
					labelledBy={`${id}-caption`} describedBy={`${id}-description`} />
				<details class="time-series-chart-data">
					<summary>View data</summary>
					<div class="time-series-chart-table" role="region" aria-label={`${props.metric} data`} tabindex={0}>
						<table>
							<caption class="visually-hidden">{props.metric} data</caption>
							<thead><tr><th scope="col">Date (UTC)</th><th scope="col">{props.metric}</th></tr></thead>
							<tbody>
								<For each={points()}>{(point) => (
									<tr><th scope="row"><time datetime={point.timestamp}>{dateFormat().format(new Date(point.timestamp))}</time></th><td>{point.value.toLocaleString()}</td></tr>
								)}</For>
							</tbody>
						</table>
					</div>
				</details>
			</Show>
		</figure>
	);
}

function TimeSeriesPlot(props: {
	points: readonly TimeSeriesPoint[];
	metric: string;
	includeTime?: boolean;
	startAt: number;
	endAt: number;
	labelledBy: string;
	describedBy: string;
}) {
	let container: HTMLDivElement | undefined;
	let chart: EChartsType | undefined;
	let observer: ResizeObserver | undefined;

	createEffect(
		() => ({ points: props.points, metric: props.metric, includeTime: props.includeTime, startAt: props.startAt, endAt: props.endAt }),
		({ points, metric, includeTime, startAt, endAt }) => {
			if (!container) return;
			if (!chart) {
				const instance = init(container, undefined, { renderer: 'svg' });
				chart = instance;
				observer = new ResizeObserver(() => instance.resize());
				observer.observe(container);
			}
			const axisDate = new Intl.DateTimeFormat('en-US', {
				timeZone: 'UTC', month: 'short', day: 'numeric',
				...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
			});
			const tooltipDate = new Intl.DateTimeFormat('en-US', {
				timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric',
				...(includeTime ? { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' as const } : {}),
			});
			const options: LineOptions = {
				animation: false,
				useUTC: true,
				color: ['#ad4a12'],
				textStyle: { fontFamily: getComputedStyle(container).fontFamily, color: '#655246' },
				grid: { left: 12, right: 20, top: 20, bottom: 12, containLabel: true },
				tooltip: {
					trigger: 'axis', confine: true,
					axisPointer: { label: { formatter: ({ value }) => tooltipDate.format(new Date(value)) } },
					valueFormatter: (value) => typeof value === 'number' ? value.toLocaleString() : String(value),
				},
				xAxis: {
					type: 'time', min: startAt, max: endAt, splitNumber: 4,
					axisLabel: { formatter: (value: number) => axisDate.format(value), hideOverlap: true },
					axisLine: { lineStyle: { color: '#c9b9ac' } },
					axisTick: { show: false },
				},
				yAxis: {
					type: 'value', min: 0, minInterval: 1, splitNumber: 4,
					axisLabel: { formatter: (value: number) => value.toLocaleString() },
					splitLine: { lineStyle: { color: '#e7ded5', type: 'dashed' } },
				},
				series: [{
					type: 'line', name: metric,
					data: points.map((point) => [Date.parse(point.timestamp), point.value]),
					showSymbol: points.length <= 60, symbol: 'circle', symbolSize: 6,
					lineStyle: { width: 2.5 }, areaStyle: { opacity: 0.08 },
					// Preserve observed values; smoothing can imply unrecorded peaks.
					smooth: false,
				}],
			};
			chart.setOption(options, { notMerge: true });
		},
	);

	onCleanup(() => {
		observer?.disconnect();
		chart?.dispose();
	});

	return <div ref={(element) => { container = element; }} class="time-series-chart-plot" role="img"
		aria-labelledby={props.labelledBy} aria-describedby={props.describedBy} />;
}
