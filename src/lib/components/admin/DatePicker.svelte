<script lang="ts">
	import { DatePicker } from 'bits-ui';
	import { CalendarDate, CalendarDateTime, type DateValue, today, getLocalTimeZone } from '@internationalized/date';

	let {
		value = $bindable(''),
		onValueChange,
		granularity = 'day',
		minValue,
		maxValue,
		disabled = false,
		name,
		weekStartsOn = 1,
	}: {
		value?: string;
		onValueChange?: (value: string) => void;
		granularity?: 'day' | 'hour' | 'minute' | 'second';
		minValue?: DateValue;
		maxValue?: DateValue;
		disabled?: boolean;
		name?: string;
		weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
	} = $props();

	function parseValue(v: string): DateValue | undefined {
		if (!v) return undefined;
		try {
			if (v.includes('T')) {
				const [date, time] = v.split('T');
				const [y, m, d] = date.split('-').map(Number);
				const parts = time.split(':').map(Number);
				return new CalendarDateTime(y, m, d, parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0);
			}
			const [y, m, d] = v.split('-').map(Number);
			return new CalendarDate(y, m, d);
		} catch {
			return undefined;
		}
	}

	function formatValue(d: DateValue): string {
		const pad = (n: number) => String(n).padStart(2, '0');
		const date = `${d.year}-${pad(d.month)}-${pad(d.day)}`;
		if ('hour' in d) {
			const dt = d as CalendarDateTime;
			return `${date}T${pad(dt.hour)}:${pad(dt.minute)}`;
		}
		return date;
	}

	let dateValue = $derived(parseValue(value));
</script>

<DatePicker.Root
	{granularity}
	{minValue}
	{maxValue}
	{disabled}
	{weekStartsOn}
	value={dateValue}
	onValueChange={(v) => {
		if (v) {
			const str = formatValue(v);
			value = str;
			onValueChange?.(str);
		} else {
			value = '';
			onValueChange?.('');
		}
	}}
>
	{#if name}
		<input type="hidden" {name} value={value} />
	{/if}
	<div class="dp-trigger">
		<DatePicker.Input>
			{#snippet child({ segments })}
				<div class="dp-segments">
					{#each segments as seg}
						<DatePicker.Segment part={seg.part}>
							{#snippet child({ props })}
								<span {...props} class="dp-segment" class:literal={seg.part === 'literal'}>
									{seg.value}
								</span>
							{/snippet}
						</DatePicker.Segment>
					{/each}
				</div>
			{/snippet}
		</DatePicker.Input>
		<DatePicker.Trigger>
			{#snippet child({ props })}
				<button {...props} class="dp-icon-btn" aria-label="Open calendar">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
						<line x1="16" y1="2" x2="16" y2="6"></line>
						<line x1="8" y1="2" x2="8" y2="6"></line>
						<line x1="3" y1="10" x2="21" y2="10"></line>
					</svg>
				</button>
			{/snippet}
		</DatePicker.Trigger>
	</div>

	<DatePicker.Content class="dp-content" sideOffset={6}>
		<DatePicker.Calendar>
			{#snippet child({ months, weekdays })}
				<div class="dp-calendar">
					<DatePicker.Header>
						{#snippet child({ props })}
							<div {...props} class="dp-header">
								<DatePicker.PrevButton>
									{#snippet child({ props: btnProps })}
										<button {...btnProps} class="dp-nav-btn">
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
										</button>
									{/snippet}
								</DatePicker.PrevButton>
								<DatePicker.Heading>
									{#snippet child({ props: headProps, headingValue })}
										<span {...headProps} class="dp-heading">{headingValue}</span>
									{/snippet}
								</DatePicker.Heading>
								<DatePicker.NextButton>
									{#snippet child({ props: btnProps })}
										<button {...btnProps} class="dp-nav-btn">
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
										</button>
									{/snippet}
								</DatePicker.NextButton>
							</div>
						{/snippet}
					</DatePicker.Header>
					{#each months as month}
						<DatePicker.Grid class="dp-grid">
							<DatePicker.GridHead>
								<DatePicker.GridRow>
									{#each weekdays as day}
										<DatePicker.HeadCell>
											{#snippet child({ props })}
												<th {...props} class="dp-head-cell">{day}</th>
											{/snippet}
										</DatePicker.HeadCell>
									{/each}
								</DatePicker.GridRow>
							</DatePicker.GridHead>
							<DatePicker.GridBody>
								{#snippet child({ props })}
									<tbody {...props}>
										{#each month.weeks as week}
											<DatePicker.GridRow>
												{#each week as date}
													<DatePicker.Cell {date} month={month.value}>
														{#snippet child({ props: cellProps })}
															<td {...cellProps} class="dp-cell">
																<DatePicker.Day>
																	{#snippet child({ props: dayProps })}
																		<button {...dayProps} class="dp-day">
																			{date.day}
																		</button>
																	{/snippet}
																</DatePicker.Day>
															</td>
														{/snippet}
													</DatePicker.Cell>
												{/each}
											</DatePicker.GridRow>
										{/each}
									</tbody>
								{/snippet}
							</DatePicker.GridBody>
						</DatePicker.Grid>
					{/each}
				</div>
			{/snippet}
		</DatePicker.Calendar>
	</DatePicker.Content>
</DatePicker.Root>

<style>
	/* ─── Trigger ─────────────────────────────────────────────── */

	.dp-trigger {
		display: flex;
		align-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		padding: 0.35rem 0.75rem;
		gap: 0.375rem;
		width: 100%;
	}

	.dp-trigger:focus-within {
		border-color: var(--color-primary);
		box-shadow: var(--shadow-focus-ring);
	}

	.dp-segments {
		display: flex;
		align-items: center;
		flex: 1;
	}

	.dp-segment {
		padding: 0.15rem 0.125rem;
		font-size: 0.9rem;
		color: var(--color-foreground);
		border-radius: var(--radius-sm);
		outline: none;
		font-variant-numeric: tabular-nums;
	}

	.dp-segment:focus {
		background: var(--color-primary);
		color: white;
	}

	.dp-segment.literal {
		color: var(--color-muted);
		padding: 0;
	}

	.dp-icon-btn {
		background: none;
		border: none;
		padding: 0.25rem;
		color: var(--color-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		border-radius: var(--radius-sm);
	}

	.dp-icon-btn:hover {
		color: var(--color-foreground);
		background: var(--color-hover);
	}

	/* ─── Calendar popup ──────────────────────────────────────── */

	:global(.dp-content) {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 1rem;
		z-index: 52;
	}

	.dp-calendar {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.dp-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.5rem;
	}

	.dp-heading {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--color-foreground);
	}

	.dp-nav-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.375rem;
		border-radius: var(--radius-sm);
		color: var(--color-muted);
		display: flex;
		align-items: center;
	}

	.dp-nav-btn:hover {
		background: var(--color-hover);
		color: var(--color-foreground);
	}

	.dp-nav-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* ─── Grid ────────────────────────────────────────────────── */

	:global(.dp-grid) {
		border-collapse: collapse;
		border-spacing: 0;
	}

	.dp-head-cell {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		padding: 0.375rem 0;
		text-align: center;
		width: 2.5rem;
	}

	.dp-cell {
		padding: 0;
	}

	/* ─── Day button ──────────────────────────────────────────── */

	.dp-day {
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

	.dp-day:hover:not([data-disabled]):not([data-outside-month]) {
		background: var(--color-hover);
	}

	/* Selected day */
	:global(.dp-day[data-selected]) {
		background: var(--color-primary);
		color: var(--color-primary-foreground);
		font-weight: 600;
	}

	:global(.dp-day[data-selected]:hover) {
		background: var(--color-primary-hover);
	}

	/* Today indicator */
	:global(.dp-day[data-today]:not([data-selected])) {
		font-weight: 700;
		color: var(--color-primary);
	}

	:global(.dp-day[data-today])::after {
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

	:global(.dp-day[data-today][data-selected])::after {
		background: var(--color-primary-foreground);
	}

	/* Outside month */
	:global(.dp-day[data-outside-month]) {
		color: var(--color-muted);
		opacity: 0.3;
		cursor: default;
	}

	/* Disabled */
	:global(.dp-day[data-disabled]:not([data-outside-month])) {
		color: var(--color-border);
		cursor: not-allowed;
	}
</style>
