import { For, Show, createEffect, createMemo, createSignal, createUniqueId, onCleanup } from 'solid-js';
import { init, registerMap, use, type ComposeOption, type EChartsType } from 'echarts/core';
import { MapChart, ScatterChart, type MapSeriesOption, type ScatterSeriesOption } from 'echarts/charts';
import { GeoComponent, TooltipComponent, VisualMapComponent, type GeoComponentOption, type TooltipComponentOption, type VisualMapComponentOption } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import type { AnalyticsCity, AnalyticsMetric } from './contracts';
import us from './data/us.geo.json?raw';
import alaska from './data/alaska.geo.json?raw';
import hawaii from './data/hawaii.geo.json?raw';
import world from './data/world.geo.json?raw';
import './geographic-reach.css';
import '~/ui/chart-data.css';

use([MapChart, ScatterChart, GeoComponent, TooltipComponent, VisualMapComponent, SVGRenderer]);
registerMap('yah-us', us);
registerMap('yah-alaska', alaska);
registerMap('yah-hawaii', hawaii);
registerMap('yah-world', world);

type MapOptions = ComposeOption<MapSeriesOption | ScatterSeriesOption | GeoComponentOption | TooltipComponentOption | VisualMapComponentOption>;
type Props = { cities: readonly AnalyticsCity[]; countries: readonly AnalyticsMetric[] };
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

function countryName(code: string): string {
	return /^[A-Z]{2}$/.test(code) ? countryNames.of(code) ?? code : code || 'Unknown country';
}

export function GeographicReach(props: Props) {
	const id = createUniqueId();
	const [worldView, setWorldView] = createSignal(false);
	const rows = createMemo(() => worldView()
		? props.countries.map(({ label, visitors }) => ({ label: countryName(label), visitors, unavailable: false }))
		: props.cities.map(({ label, visitors, coordinates }) => ({ label, visitors, unavailable: !coordinates })));
	const unmapped = createMemo(() => props.cities.filter(({ coordinates }) => !coordinates).length);
	const scope = () => worldView() ? 'World · visitors by country' : 'United States · visitors by city';

	return (
		<section class="geographic-reach" aria-labelledby={`${id}-heading`}>
			<header class="geographic-reach-header">
				<div>
					<h2 id={`${id}-heading`}>Geographic Reach</h2>
					<p id={`${id}-scope`} aria-live="polite">{scope()}</p>
				</div>
				<button type="button" class="button button--secondary" onClick={() => setWorldView((value) => !value)}>
					{worldView() ? 'Reset to US' : 'Show world'}
				</button>
			</header>
			<GeographicPlot {...props} worldView={worldView()} labelledBy={`${id}-scope`} />
			<Show when={rows().length > 0} fallback={<p class="geographic-reach-note">No {worldView() ? 'country' : 'US city'} data for this period.</p>}>
				<Show when={!worldView()}>
					<p class="geographic-reach-note">Larger dots mean more visitors. Locations are approximate.
						{unmapped() > 0 ? ` ${unmapped()} ${unmapped() === 1 ? 'location is' : 'locations are'} available only in the table.` : ''}
						{props.cities.length === 500 ? ' Showing the top 500 city entries.' : ''}
					</p>
				</Show>
				<details class="chart-data">
					<summary>View data</summary>
					<div class="chart-data-table" role="region" aria-label={scope()} tabindex={0}>
						<table>
							<caption class="visually-hidden">{worldView() ? 'Visitors by country' : 'Visitors by US city'}</caption>
							<thead><tr><th scope="col">{worldView() ? 'Country' : 'City'}</th><th scope="col">Visitors</th></tr></thead>
							<tbody><For each={rows()}>{(row) => <tr>
								<th scope="row">{row.label}<Show when={row.unavailable}><small>Location unavailable</small></Show></th>
								<td>{row.visitors.toLocaleString()}</td>
							</tr>}</For></tbody>
						</table>
					</div>
				</details>
			</Show>
			<p class="geographic-reach-credit">Maps: <a href="https://www.naturalearthdata.com/">Natural Earth</a> · Cities: <a href="https://www.geonames.org/">GeoNames</a> (<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>)</p>
		</section>
	);
}

function GeographicPlot(props: Props & { worldView: boolean; labelledBy: string }) {
	let container: HTMLDivElement | undefined;
	let chart: EChartsType | undefined;
	let observer: ResizeObserver | undefined;
	let options: MapOptions | undefined;
	let optionsChanged = false;

	function renderChart() {
		// Route loading can mount this component inside a hidden container.
		// ECharts cannot invert a geographic transform with zero dimensions.
		if (!container?.clientWidth || !container.clientHeight || !options) return;
		if (!chart) chart = init(container, undefined, { renderer: 'svg' });
		else chart.resize();
		if (optionsChanged) {
			chart.setOption(options, { notMerge: true });
			optionsChanged = false;
		}
	}

	createEffect(
		() => ({ cities: props.cities, countries: props.countries, worldView: props.worldView }),
		({ cities, countries, worldView }) => {
			if (!container) return;
			if (!observer) {
				observer = new ResizeObserver(renderChart);
				observer.observe(container);
			}
			const maximum = Math.max(1, ...(worldView ? countries : cities).map(({ visitors }) => visitors));
			const land = { areaColor: '#eee5da', borderColor: '#b7a38e', borderWidth: 0.7 };
			options = {
				animation: false,
				textStyle: { fontFamily: getComputedStyle(container).fontFamily, color: '#655246' },
				tooltip: {
					trigger: 'item', confine: true,
					formatter: (params) => {
						const item = Array.isArray(params) ? params[0] : params;
						const value = Array.isArray(item?.value) ? item.value[2] : item?.value;
						const name = worldView ? countryName(item?.name ?? '') : item?.name ?? '';
						const content = document.createElement('div');
						content.textContent = `${name}: ${typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '0'} visitors`;
						return content;
					},
				},
				...(worldView ? {
					visualMap: { show: countries.length > 0, min: 0, max: maximum, left: 'center', bottom: 0, orient: 'horizontal',
						inRange: { color: ['#eee5da', '#cf8b50', '#8a350e'] }, text: [maximum.toLocaleString(), '0'], calculable: false },
					series: [{ type: 'map', map: 'yah-world', top: 8, bottom: 58, left: 8, right: 8,
						roam: false, selectedMode: false, preserveAspect: true, itemStyle: land,
						emphasis: { label: { show: false }, itemStyle: { borderColor: '#74320e', borderWidth: 1.5 } },
						data: countries.filter(({ label }) => label).map(({ label, visitors }) => ({ name: label, value: visitors })),
					}] satisfies MapSeriesOption[],
				} : {
					geo: [
						{ map: 'yah-us', left: '14%', top: '2%', width: '84%', height: '80%' },
						{ map: 'yah-alaska', left: '1%', top: '69%', width: '24%', height: '28%' },
						{ map: 'yah-hawaii', left: '27%', top: '83%', width: '12%', height: '14%' },
					].map((layout) => ({ ...layout, preserveAspect: true, roam: false, silent: true, itemStyle: land, emphasis: { disabled: true } })),
					series: ['', 'AK', 'HI'].map((state, geoIndex): ScatterSeriesOption => ({
						type: 'scatter', coordinateSystem: 'geo', geoIndex, name: 'Visitors',
						data: cities.filter(({ region, coordinates, visitors }) => coordinates && visitors > 0 && (state ? region === state : region !== 'AK' && region !== 'HI')).map((city) => ({
							name: city.label,
							value: [city.region === 'AK' && city.coordinates![0] > 0 ? city.coordinates![0] - 360 : city.coordinates![0], city.coordinates![1], city.visitors],
						})),
						symbolSize: (value: number[]) => 6 + 22 * Math.sqrt((value[2] ?? 0) / maximum),
						itemStyle: { color: '#ad4a12', opacity: 0.75, borderColor: '#fff7ef', borderWidth: 1 },
						emphasis: { scale: 1.3, itemStyle: { opacity: 1 } },
					})),
				}),
			};
			optionsChanged = true;
			renderChart();
		},
	);

	onCleanup(() => { observer?.disconnect(); chart?.dispose(); });
	return <div ref={(element) => { container = element; }} class="geographic-reach-plot" role="img" aria-labelledby={props.labelledBy} />;
}
