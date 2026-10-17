import { render } from '@solidjs/web';
import { createSignal, flush, type Setter } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyticsCity } from './contracts';

const renderer = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock('echarts/core', () => ({ init: renderer.init, use: vi.fn(), registerMap: vi.fn() }));
vi.mock('echarts/charts', () => ({ MapChart: {}, ScatterChart: {} }));
vi.mock('echarts/components', () => ({ GeoComponent: {}, TooltipComponent: {}, VisualMapComponent: {} }));
vi.mock('echarts/renderers', () => ({ SVGRenderer: {} }));

import { GeographicReach } from './geographic-reach';

const chart = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() };
const observer = { observe: vi.fn(), disconnect: vi.fn() };
let notifyResize: () => void;
const cities: AnalyticsCity[] = [
	{ label: 'Austin, TX', region: 'TX', coordinates: [-97.743, 30.267], visitors: 20 },
	{ label: 'Anchorage, AK', region: 'AK', coordinates: [-149.9, 61.218], visitors: 4 },
	{ label: 'Honolulu, HI', region: 'HI', coordinates: [-157.858, 21.307], visitors: 2 },
	{ label: 'Unknown city', region: '', coordinates: null, visitors: 3 },
];
let dispose: () => void;

beforeEach(() => {
	renderer.init.mockReturnValue(chart);
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
	vi.stubGlobal('ResizeObserver', class {
		observe = observer.observe;
		disconnect = observer.disconnect;
		constructor(callback: () => void) { notifyResize = callback; }
	});
});
afterEach(() => { dispose(); document.body.replaceChildren(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mount(initial = cities) {
	let update!: Setter<AnalyticsCity[]>;
	dispose = render(() => {
		const [data, setData] = createSignal(initial);
		update = setData;
		return <GeographicReach cities={data()} countries={[{ label: 'US', visitors: 29 }, { label: 'SG', visitors: 8 }, { label: '', visitors: 5 }]} />;
	}, document.body);
	flush();
	return update;
}

function button(label: string) {
	return Array.from(document.querySelectorAll('button')).find((element) => element.getAttribute('aria-label') === label)!;
}

function showUS() {
	button('Zoom out to United States').click();
	flush();
}

describe('GeographicReach', () => {
	it('waits for a visible container and uses the latest data after route loading finishes', () => {
		const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(0);
		const update = mount();
		showUS();
		expect(renderer.init).not.toHaveBeenCalled();
		update([{ ...cities[0]!, visitors: 100 }]);
		flush();
		width.mockReturnValue(800);
		notifyResize();
		expect(renderer.init).toHaveBeenCalledOnce();
		expect(chart.setOption.mock.calls.at(-1)![0].series[0].data[0].value).toEqual([-97.743, 30.267, 100]);
		width.mockReturnValue(0);
		notifyResize();
		expect(chart.resize).not.toHaveBeenCalled();
		width.mockReturnValue(500);
		notifyResize();
		expect(chart.resize).toHaveBeenCalledOnce();
		expect(chart.setOption).toHaveBeenCalledOnce();
	});

	it('plots cities in the correct US view and retains unresolved locations in the accessible table', () => {
		mount();
		showUS();
		const options = chart.setOption.mock.calls.at(-1)![0];
		expect(options.series.map((series: { data: { name: string }[] }) => series.data.map(({ name }) => name))).toEqual([
			['Austin, TX'], ['Anchorage, AK'], ['Honolulu, HI'],
		]);
		expect(button('Zoom out to world')).toBeDefined();
		expect(document.querySelectorAll('tbody tr')).toHaveLength(4);
		expect(document.querySelector('tbody')?.textContent).toContain('Unknown cityLocation unavailable3');
		expect(document.querySelector<HTMLElement>('[role="region"]')?.tabIndex).toBe(0);
	});

	it('switches to independent country totals, keeps small countries in the table, and resets to US without recreating the chart', () => {
		mount();
		showUS();
		button('Zoom out to world').click();
		flush();
		const options = chart.setOption.mock.calls.at(-1)![0];
		expect(options.series[0]).toMatchObject({ type: 'map', data: [{ name: 'US', value: 29 }, { name: 'SG', value: 8 }] });
		expect(button('Zoom in to United States')).toBeDefined();
		expect(button('Zoom out').disabled).toBe(true);
		expect(document.querySelector('tbody')?.textContent).toBe('United States29Singapore8Unknown country5');
		button('Zoom in to United States').click();
		flush();
		expect(chart.setOption.mock.calls.at(-1)![0].series[0].type).toBe('scatter');
		expect(renderer.init).toHaveBeenCalledOnce();
	});

	it('starts in NYC without including nearby towns or assigning citywide counts to a borough', () => {
		const update = mount([
			...cities,
			{ label: 'New York, NY', region: 'NY', coordinates: [-74.006, 40.714], visitors: 14 },
			{ label: 'Brooklyn, NY', region: 'NY', coordinates: [-73.95, 40.65], visitors: 8 },
			{ label: 'Great Neck, NY', region: 'NY', coordinates: [-73.728, 40.801], visitors: 3 },
		]);
		const options = chart.setOption.mock.calls.at(-1)![0];
		expect(options.geo).toHaveLength(1);
		expect(options.geo[0].map).toBe('yah-nyc');
		expect(button('Zoom in').disabled).toBe(true);
		expect(options.series[0].data.map(({ name }: { name: string }) => name)).toEqual(['New York, NY', 'Brooklyn, NY']);
		expect(document.querySelector('tbody')?.textContent).toBe('New York, NY14Brooklyn, NY8');
		update(cities);
		flush();
		expect(document.body.textContent).toContain('No NYC location data for this period.');
		button('Zoom out to United States').click();
		flush();
		expect(document.querySelectorAll('tbody tr')).toHaveLength(cities.length);
		expect(renderer.init).toHaveBeenCalledOnce();
	});

	it('updates counts, handles empty periods, and releases the chart on navigation', () => {
		const update = mount();
		showUS();
		update([{ ...cities[0]!, visitors: 100 }]);
		flush();
		expect(chart.setOption.mock.calls.at(-1)![0].series[0].data[0].value).toEqual([-97.743, 30.267, 100]);
		update([]);
		flush();
		expect(document.body.textContent).toContain('No US city data for this period.');
		expect(document.querySelector('details')).toBeNull();
		dispose();
		expect(chart.dispose).toHaveBeenCalledOnce();
		expect(observer.disconnect).toHaveBeenCalledOnce();
	});

	it('renders provider labels as text in tooltips', () => {
		mount();
		const options = chart.setOption.mock.calls.at(-1)![0];
		const tooltip = options.tooltip.formatter({ name: '<img src=x onerror=alert(1)>', value: [-97, 30, 3] });
		expect(tooltip.textContent).toBe('<img src=x onerror=alert(1)>: 3 visitors');
		expect(tooltip.children).toHaveLength(0);
	});
});
