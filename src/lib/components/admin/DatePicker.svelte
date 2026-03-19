<script lang="ts">
	import './calendar.css';
	import { DatePicker } from 'bits-ui';
	import { CalendarDate, CalendarDateTime, type DateValue } from '@internationalized/date';

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
	<div class="cal-trigger" class:dp-full-width={true}>
		<DatePicker.Input>
			{#snippet child({ segments })}
				<div class="cal-segments" style="flex:1">
					{#each segments as seg}
						<DatePicker.Segment part={seg.part}>
							{#snippet child({ props })}
								<span {...props} class="cal-segment" class:literal={seg.part === 'literal'}>
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
				<button {...props} class="cal-icon-btn" aria-label="Open calendar">
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

	<DatePicker.Content class="cal-content" sideOffset={6}>
		<DatePicker.Calendar>
			{#snippet child({ months, weekdays })}
				<div class="cal-calendar">
					<DatePicker.Header>
						{#snippet child({ props })}
							<div {...props} class="cal-header">
								<DatePicker.PrevButton>
									{#snippet child({ props: btnProps })}
										<button {...btnProps} class="cal-nav-btn">
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
										</button>
									{/snippet}
								</DatePicker.PrevButton>
								<DatePicker.Heading>
									{#snippet child({ props: headProps, headingValue })}
										<span {...headProps} class="cal-heading">{headingValue}</span>
									{/snippet}
								</DatePicker.Heading>
								<DatePicker.NextButton>
									{#snippet child({ props: btnProps })}
										<button {...btnProps} class="cal-nav-btn">
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
										</button>
									{/snippet}
								</DatePicker.NextButton>
							</div>
						{/snippet}
					</DatePicker.Header>
					{#each months as month}
						<DatePicker.Grid class="cal-grid">
							<DatePicker.GridHead>
								<DatePicker.GridRow>
									{#each weekdays as day}
										<DatePicker.HeadCell>
											{#snippet child({ props })}
												<th {...props} class="cal-head-cell">{day}</th>
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
															<td {...cellProps} class="cal-cell">
																<DatePicker.Day>
																	{#snippet child({ props: dayProps })}
																		<button {...dayProps} class="cal-day">
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
	.dp-full-width {
		width: 100%;
	}

	:global(.cal-content) {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 1rem;
		z-index: var(--z-dropdown);
	}

	:global(.cal-grid) {
		border-collapse: collapse;
		border-spacing: 0;
	}
</style>
