<script lang="ts">
	let {
		bars,
		color = 'var(--brand-olive)',
		hoverColor,
		formatLabel = (x: string) => x,
	}: {
		bars: { x: string; y: number }[];
		color?: string;
		hoverColor?: string;
		formatLabel?: (x: string) => string;
	} = $props();

	let max = $derived(Math.max(...bars.map((b) => b.y), 1));
</script>

{#if bars.length > 0}
	<div class="chart">
		<div class="chart-bars">
			{#each bars as point}
				<div class="chart-col">
					<div class="chart-tooltip">{point.y}</div>
					<div
						class="chart-bar"
						style="height: {(point.y / max) * 100}%; --bar-color: {color}; --bar-hover: {hoverColor ?? color}"
					></div>
					<span class="chart-label">{formatLabel(point.x)}</span>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
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
		background: var(--bar-color);
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		transition: height 0.3s ease;
	}

	.chart-col:hover .chart-bar {
		background: var(--bar-hover);
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
</style>
