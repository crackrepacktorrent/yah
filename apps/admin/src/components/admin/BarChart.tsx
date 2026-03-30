import type { Component } from "solid-js";
import { For, Show, createMemo } from "solid-js";
import "./BarChart.css";

type Bar = { x: string; y: number };

type BarChartProps = {
  bars: Bar[];
  color?: string;
  hoverColor?: string;
  formatLabel?: (x: string) => string;
};

export const BarChart: Component<BarChartProps> = (props) => {
  const max = createMemo(() => Math.max(...props.bars.map((b) => b.y), 1));
  const formatLabel = createMemo(() => props.formatLabel ?? ((x: string) => x));

  return (
    <Show when={props.bars.length > 0}>
      <div class="chart">
        <div class="chart-bars">
          <For each={props.bars}>
            {(point) => (
              <div class="chart-col">
                <div class="chart-tooltip">{point.y}</div>
                <div
                  class="chart-bar"
                  style={{
                    height: `${(point.y / max()) * 100}%`,
                    "--bar-color": props.color ?? "var(--brand-olive)",
                    "--bar-hover": props.hoverColor ?? props.color ?? "var(--brand-olive)",
                  }}
                />
                <span class="chart-label">{formatLabel()(point.x)}</span>
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
};
