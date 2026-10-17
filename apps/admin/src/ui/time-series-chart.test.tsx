import { render } from '@solidjs/web';
import { createSignal, flush, type Setter } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const renderer = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock('echarts/core', () => ({ init: renderer.init, use: vi.fn() }));
vi.mock('echarts/charts', () => ({ LineChart: {} }));
vi.mock('echarts/components', () => ({ GridComponent: {}, TooltipComponent: {} }));
vi.mock('echarts/renderers', () => ({ SVGRenderer: {} }));

import { TimeSeriesChart, type TimeSeriesChartProps } from './time-series-chart';

const disposers: Array<() => void> = [];
const charts: Array<{ setOption: ReturnType<typeof vi.fn>; resize: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }> = [];
const observers: Array<{ notify: () => void; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];

function mount(initial: Partial<TimeSeriesChartProps> = {}) {
	const container = document.createElement('div');
	document.body.append(container);
	let update!: Setter<TimeSeriesChartProps>;
	const dispose = render(() => {
		const [props, setProps] = createSignal<TimeSeriesChartProps>({
			caption: 'Pageviews over the last 7 days', metric: 'Pageviews', interval: 'day',
			range: { startAt: Date.parse('2026-08-23T00:00:00Z'), endAt: Date.parse('2026-08-23T23:59:59.999Z') },
			points: [{ timestamp: '2026-08-23T00:00:00Z', value: 0 }],
			emptyMessage: 'No pageviews were recorded in this period.', ...initial,
		});
		update = setProps;
		return <TimeSeriesChart {...props()} />;
	}, container);
	disposers.push(() => { dispose(); container.remove(); });
	flush();
	return { container, update, dispose };
}

beforeEach(() => {
	charts.length = 0;
	observers.length = 0;
	renderer.init.mockImplementation(() => {
		const chart = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() };
		charts.push(chart);
		return chart;
	});
	vi.stubGlobal('ResizeObserver', class {
		observe = vi.fn();
		disconnect = vi.fn();
		constructor(notify: () => void) { observers.push({ notify, observe: this.observe, disconnect: this.disconnect }); }
	});
});

afterEach(() => {
	for (const dispose of disposers.splice(0).reverse()) dispose();
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

describe('TimeSeriesChart', () => {
	it('plots zero-event days inside and at both ends of the requested range', () => {
		const range = { startAt: Date.parse('2026-08-22T00:00:00Z'), endAt: Date.parse('2026-08-26T23:59:59.999Z') };
		const { container } = mount({ range, points: [
			{ timestamp: '2026-08-25T00:00:00Z', value: 10 },
			{ timestamp: '2026-08-23T00:00:00Z', value: 10 },
		] });
		const options = charts[0]!.setOption.mock.calls[0]![0];
		expect(options.xAxis).toMatchObject({ min: range.startAt, max: range.endAt });
		expect(options.series[0].data).toEqual([0, 10, 0, 10, 0].map((value, index) => [Date.UTC(2026, 7, 22 + index), value]));
		expect([...container.querySelectorAll('tbody td')].map((cell) => cell.textContent)).toEqual(['0', '10', '0', '10', '0']);
	});

	it('keeps partial first and last hours in the domain even when only the middle hour has events', () => {
		const { container } = mount({ interval: 'hour', range: { startAt: Date.parse('2026-08-23T00:30:00Z'), endAt: Date.parse('2026-08-23T02:15:00Z') },
			points: [{ timestamp: '2026-08-23T01:00:00Z', value: 6 }],
		});
		const options = charts[0]!.setOption.mock.calls[0]![0];
		expect(options.xAxis).toMatchObject({ min: Date.UTC(2026, 7, 23), max: Date.UTC(2026, 7, 23, 2, 15) });
		expect(options.series[0].data).toEqual([0, 6, 0].map((value, hour) => [Date.UTC(2026, 7, 23, hour), value]));
		expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
	});

	it('plots chronological instants and exposes the exact values in a named UTC data table', () => {
		const { container } = mount({ interval: 'hour', range: { startAt: Date.parse('2026-08-23T01:00:00Z'), endAt: Date.parse('2026-08-23T14:59:59.999Z') }, points: [
			{ timestamp: '2026-08-23T14:00:00Z', value: 7 },
			{ timestamp: '2026-08-23T03:00:00+02:00', value: 0 },
		] });
		const options = charts[0]!.setOption.mock.calls[0]![0];
		expect(options.series[0].data).toEqual(Array.from({ length: 14 }, (_, index) => [Date.UTC(2026, 7, 23, index + 1), index === 13 ? 7 : 0]));
		expect(options.xAxis.type).toBe('time');
		expect(options.yAxis.min).toBe(0);
		const plot = container.querySelector('[role="img"]')!;
		expect(container.querySelector(`#${plot.getAttribute('aria-labelledby')}`)?.textContent).toBe('Pageviews over the last 7 days');
		expect(container.querySelector('table caption')?.textContent).toBe('Pageviews data');
		expect(container.querySelector<HTMLElement>('[role="region"]')?.tabIndex).toBe(0);
		expect(container.querySelector('tbody tr:first-child')?.textContent).toBe('Aug 23, 2026, 1:00 AM UTC0');
		expect(container.querySelector('tbody tr:last-child')?.textContent).toBe('Aug 23, 2026, 2:00 PM UTC7');
		expect(container.querySelector('summary')?.textContent).toBe('View data');
	});

	it('updates the existing chart after filters change and releases its observer and renderer on disposal', () => {
		const { container, update, dispose } = mount();
		const chart = charts[0]!;
		const observer = observers[0]!;
		update((props) => ({ ...props, caption: 'Pageviews over the last 24 hours', interval: 'hour',
			range: { startAt: Date.parse('2026-08-24T14:00:00Z'), endAt: Date.parse('2026-08-24T14:59:59.999Z') },
			points: [{ timestamp: '2026-08-24T14:00:00Z', value: 9 }],
		}));
		flush();
		expect(renderer.init).toHaveBeenCalledTimes(1);
		expect(chart.setOption.mock.calls.at(-1)![0].series[0].data).toEqual([[Date.parse('2026-08-24T14:00:00Z'), 9]]);
		expect(container.querySelector('figcaption')?.textContent).toBe('Pageviews over the last 24 hours');
		expect(container.querySelector('tbody')?.textContent).toContain('Aug 24, 2026, 2:00 PM UTC');
		observer.notify();
		expect(chart.resize).toHaveBeenCalledOnce();
		dispose();
		expect(observer.disconnect).toHaveBeenCalledOnce();
		expect(chart.dispose).toHaveBeenCalledOnce();
	});

	it('distinguishes no observations from a recorded zero and disposes charts that become empty', () => {
		const { container, update } = mount({ points: [] });
		expect(renderer.init).not.toHaveBeenCalled();
		expect(container.textContent).toContain('No pageviews were recorded');
		expect(container.querySelector('details')).toBeNull();
		update((props) => ({ ...props, points: [{ timestamp: '2026-08-23T00:00:00Z', value: 0 }] }));
		flush();
		expect(charts).toHaveLength(1);
		expect(container.querySelector('tbody td')?.textContent).toBe('0');
		update((props) => ({ ...props, points: [] }));
		flush();
		expect(charts[0]!.dispose).toHaveBeenCalledOnce();
		expect(observers[0]!.disconnect).toHaveBeenCalledOnce();
		expect(container.querySelector('[role="img"]')).toBeNull();
	});
});
