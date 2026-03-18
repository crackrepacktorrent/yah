<script lang="ts">
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
	<div class="drp-trigger">
		<DateRangePicker.Input type="start">
			{#snippet child({ segments })}
				<div class="drp-segments">
					{#each segments as seg}
						<DateRangePicker.Segment part={seg.part}>
							{#snippet child({ props })}
								<span {...props} class="drp-segment" class:literal={seg.part === 'literal'}>
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
				<div class="drp-segments">
					{#each segments as seg}
						<DateRangePicker.Segment part={seg.part}>
							{#snippet child({ props })}
								<span {...props} class="drp-segment" class:literal={seg.part === 'literal'}>
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
				<button {...props} class="drp-icon-btn" aria-label="Open calendar">
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

	<DateRangePicker.Content class="drp-content" sideOffset={6}>
		<DateRangePicker.Calendar>
			{#snippet child({ months, weekdays })}
				<div class="drp-calendar">
					<DateRangePicker.Header>
						{#snippet child({ props })}
							<div {...props} class="drp-header">
								<DateRangePicker.PrevButton>
									{#snippet child({ props: btnProps })}
										<button {...btnProps} class="drp-nav-btn">
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
										</button>
									{/snippet}
								</DateRangePicker.PrevButton>
								<DateRangePicker.Heading>
									{#snippet child({ props: headProps, headingValue })}
										<span {...headProps} class="drp-heading">{headingValue}</span>
									{/snippet}
								</DateRangePicker.Heading>
								<DateRangePicker.NextButton>
									{#snippet child({ props: btnProps })}
										<button {...btnProps} class="drp-nav-btn">
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
										</button>
									{/snippet}
								</DateRangePicker.NextButton>
							</div>
						{/snippet}
					</DateRangePicker.Header>
					{#each months as month}
						<DateRangePicker.Grid class="drp-grid">
							<DateRangePicker.GridHead>
								<DateRangePicker.GridRow>
									{#each weekdays as day}
										<DateRangePicker.HeadCell>
											{#snippet child({ props })}
												<th {...props} class="drp-head-cell">{day}</th>
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
														{#snippet child({ props: cellProps, disabled: cellDisabled })}
															<td {...cellProps} class="drp-cell">
																<DateRangePicker.Day>
																	{#snippet child({ props: dayProps, selected: daySelected, disabled: dayDisabled })}
																		<button
																			{...dayProps}
																			class="drp-day"
																		>
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
	/* ─── Trigger ─────────────────────────────────────────────── */

	.drp-trigger {
		display: flex;
		align-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		padding: 0.35rem 0.75rem;
		gap: 0.375rem;
	}

	.drp-trigger:focus-within {
		border-color: var(--color-primary);
		box-shadow: var(--shadow-focus-ring);
	}

	.drp-segments {
		display: flex;
		align-items: center;
	}

	.drp-segment {
		padding: 0.15rem 0.125rem;
		font-size: 0.9rem;
		color: var(--color-foreground);
		border-radius: var(--radius-sm);
		outline: none;
		font-variant-numeric: tabular-nums;
	}

	.drp-segment:focus {
		background: var(--color-primary);
		color: white;
	}

	.drp-segment.literal {
		color: var(--color-muted);
		padding: 0;
	}

	.drp-sep {
		color: var(--color-muted);
		font-size: 0.85rem;
		padding: 0 0.125rem;
	}

	.drp-icon-btn {
		background: none;
		border: none;
		padding: 0.25rem;
		color: var(--color-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		border-radius: var(--radius-sm);
	}

	.drp-icon-btn:hover {
		color: var(--color-foreground);
		background: var(--color-hover);
	}

	/* ─── Calendar popup ──────────────────────────────────────── */

	:global(.drp-content) {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 1rem;
		z-index: var(--z-dropdown);
	}

	.drp-calendar {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.drp-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.5rem;
	}

	.drp-heading {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--color-foreground);
	}

	.drp-nav-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.375rem;
		border-radius: var(--radius-sm);
		color: var(--color-muted);
		display: flex;
		align-items: center;
	}

	.drp-nav-btn:hover {
		background: var(--color-hover);
		color: var(--color-foreground);
	}

	.drp-nav-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* ─── Grid ────────────────────────────────────────────────── */

	:global(.drp-grid) {
		border-collapse: collapse;
		border-spacing: 0;
	}

	.drp-head-cell {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		padding: 0.375rem 0;
		text-align: center;
		width: 2.5rem;
	}

	/* ─── Cell: range background on td ────────────────────────── */

	.drp-cell {
		padding: 0;
		position: relative;
	}

	/* In-range background band (middle days) */
	:global(.drp-cell[data-range-middle][data-selected]) {
		background: var(--brand-orange-muted);
	}

	/* Range start cell: half-background on right side */
	:global(.drp-cell[data-range-start][data-selected]) {
		background: linear-gradient(to right, transparent 50%, var(--brand-orange-muted) 50%);
	}

	/* Range end cell: half-background on left side */
	:global(.drp-cell[data-range-end][data-selected]) {
		background: linear-gradient(to left, transparent 50%, var(--brand-orange-muted) 50%);
	}

	/* Single-day selection (start == end): no band */
	:global(.drp-cell[data-range-start][data-range-end]) {
		background: none;
	}

	/* ─── Highlight preview (hovering to pick end date) ──────── */

	/* Preview band on in-between cells */
	:global(.drp-cell[data-highlighted]:not([data-selected]):not([data-range-start]):not([data-range-end])) {
		background: var(--brand-orange-muted);
	}

	/* Preview: start cell gets half-band on right */
	:global(.drp-cell[data-range-start][data-highlighted]:not([data-range-end])) {
		background: linear-gradient(to right, transparent 50%, var(--brand-orange-muted) 50%);
	}

	/* ─── Day button ──────────────────────────────────────────── */

	.drp-day {
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: none;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		color: var(--color-foreground);
		cursor: pointer;
		position: relative;
		font-variant-numeric: tabular-nums;
	}

	.drp-day:hover:not([data-disabled]):not([data-outside-month]) {
		background: var(--color-hover);
	}

	/* Highlighted preview days (between start click and hover) */
	:global(.drp-day[data-highlighted]:not([data-selected]):not([data-range-start]):not([data-range-end])) {
		background: none;
		color: var(--brand-orange-dark);
		font-weight: 500;
		border-radius: 0;
	}

	/* Range endpoints: solid primary pill */
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

	/* In-range days: subtle tinted text, no background (td handles the band) */
	:global(.drp-day[data-range-middle][data-selected]) {
		background: none;
		color: var(--brand-orange-dark);
		font-weight: 500;
		border-radius: 0;
	}

	:global(.drp-day[data-range-middle][data-selected]:hover) {
		background: color-mix(in srgb, var(--color-primary) 25%, transparent);
	}

	/* Today indicator: dotted underline */
	:global(.drp-day[data-today]:not([data-selected])) {
		font-weight: 700;
		color: var(--color-primary);
	}

	:global(.drp-day[data-today])::after {
		content: '';
		position: absolute;
		bottom: 3px;
		left: 50%;
		transform: translateX(-50%);
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--color-primary);
	}

	:global(.drp-day[data-today][data-range-start][data-selected])::after,
	:global(.drp-day[data-today][data-range-end][data-selected])::after {
		background: var(--color-primary-foreground);
	}

	/* Outside month: very faded */
	:global(.drp-day[data-outside-month]) {
		color: var(--color-muted);
		opacity: 0.3;
		cursor: default;
	}

	/* Disabled (future dates etc): distinct from outside-month */
	:global(.drp-day[data-disabled]:not([data-outside-month])) {
		color: var(--color-border);
		cursor: not-allowed;
	}
</style>
