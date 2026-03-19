<script lang="ts">
	import './calendar.css';
	import { DateRangePicker } from 'bits-ui';
	import type { DateValue } from '@internationalized/date';

	let {
		value = $bindable({ start: undefined, end: undefined }),
		maxValue,
		minValue,
		weekStartsOn = 1,
	}: {
		value?: { start: DateValue | undefined; end: DateValue | undefined };
		maxValue?: DateValue;
		minValue?: DateValue;
		weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
	} = $props();
</script>

<DateRangePicker.Root bind:value {maxValue} {minValue} {weekStartsOn}>
	<div class="cal-trigger">
		<DateRangePicker.Input type="start">
			{#snippet child({ segments })}
				<div class="cal-segments">
					{#each segments as seg}
						<DateRangePicker.Segment part={seg.part}>
							{#snippet child({ props })}
								<span {...props} class="cal-segment" class:literal={seg.part === 'literal'}>
									{seg.value}
								</span>
							{/snippet}
						</DateRangePicker.Segment>
					{/each}
				</div>
			{/snippet}
		</DateRangePicker.Input>
		<span class="drp-sep">&ndash;</span>
		<DateRangePicker.Input type="end">
			{#snippet child({ segments })}
				<div class="cal-segments">
					{#each segments as seg}
						<DateRangePicker.Segment part={seg.part}>
							{#snippet child({ props })}
								<span {...props} class="cal-segment" class:literal={seg.part === 'literal'}>
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
				<button {...props} type="button" class="cal-icon-btn" aria-label="Open calendar">
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

	<DateRangePicker.Content class="cal-content" sideOffset={6}>
		<DateRangePicker.Calendar>
			{#snippet child({ months, weekdays })}
				<div class="cal-calendar">
					<DateRangePicker.Header>
						{#snippet child({ props })}
							<div {...props} class="cal-header">
								<DateRangePicker.PrevButton>
									{#snippet child({ props: btnProps })}
										<button {...btnProps} type="button" class="cal-nav-btn">
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
										</button>
									{/snippet}
								</DateRangePicker.PrevButton>
								<DateRangePicker.Heading>
									{#snippet child({ props: headProps, headingValue })}
										<span {...headProps} class="cal-heading">{headingValue}</span>
									{/snippet}
								</DateRangePicker.Heading>
								<DateRangePicker.NextButton>
									{#snippet child({ props: btnProps })}
										<button {...btnProps} type="button" class="cal-nav-btn">
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
										</button>
									{/snippet}
								</DateRangePicker.NextButton>
							</div>
						{/snippet}
					</DateRangePicker.Header>
					{#each months as month}
						<DateRangePicker.Grid class="cal-grid">
							<DateRangePicker.GridHead>
								<DateRangePicker.GridRow>
									{#each weekdays as day}
										<DateRangePicker.HeadCell>
											{#snippet child({ props })}
												<th {...props} class="cal-head-cell">{day}</th>
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
														{#snippet child({ props: cellProps })}
															<td {...cellProps} class="cal-cell drp-cell">
																<DateRangePicker.Day>
																	{#snippet child({ props: dayProps })}
																		<button {...dayProps} type="button" class="cal-day drp-day">
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

<style>
	.drp-sep {
		color: var(--color-muted);
		font-size: 0.85rem;
		padding: 0 0.125rem;
	}

	/* ─── Range-specific: cell backgrounds ────────────────────── */

	.drp-cell {
		position: relative;
	}

	:global(.drp-cell[data-range-middle][data-selected]) {
		background: var(--brand-orange-muted);
	}

	:global(.drp-cell[data-range-start][data-selected]) {
		background: linear-gradient(to right, transparent 50%, var(--brand-orange-muted) 50%);
	}

	:global(.drp-cell[data-range-end][data-selected]) {
		background: linear-gradient(to left, transparent 50%, var(--brand-orange-muted) 50%);
	}

	:global(.drp-cell[data-range-start][data-range-end]) {
		background: none;
	}

	:global(.drp-cell[data-highlighted]:not([data-selected]):not([data-range-start]):not([data-range-end])) {
		background: var(--brand-orange-muted);
	}

	:global(.drp-cell[data-range-start][data-highlighted]:not([data-range-end])) {
		background: linear-gradient(to right, transparent 50%, var(--brand-orange-muted) 50%);
	}

	/* ─── Range-specific: day button overrides ────────────────── */

	:global(.drp-day[data-highlighted]:not([data-selected]):not([data-range-start]):not([data-range-end])) {
		background: none;
		color: var(--brand-orange-dark);
		font-weight: 500;
		border-radius: 0;
	}

	:global(.drp-day[data-range-start][data-selected]),
	:global(.drp-day[data-range-end][data-selected]) {
		background: var(--color-primary);
		color: var(--color-primary-foreground);
		font-weight: 600;
		border-radius: var(--radius-sm);
	}

	:global(.drp-day[data-range-start][data-selected]:hover),
	:global(.drp-day[data-range-end][data-selected]:hover) {
		background: var(--color-primary-hover);
	}

	:global(.drp-day[data-range-middle][data-selected]) {
		background: none;
		color: var(--brand-orange-dark);
		font-weight: 500;
		border-radius: 0;
	}

	:global(.drp-day[data-range-middle][data-selected]:hover) {
		background: color-mix(in srgb, var(--color-primary) 25%, transparent);
	}

	:global(.drp-day[data-today][data-range-start][data-selected])::after,
	:global(.drp-day[data-today][data-range-end][data-selected])::after {
		background: var(--color-primary-foreground);
	}
</style>
