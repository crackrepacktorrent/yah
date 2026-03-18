<script lang="ts">
	import { Select } from 'bits-ui';

	let {
		value = $bindable(''),
		onValueChange,
		options,
		placeholder = 'Select...',
		disabled = false,
		name,
		class: className = '',
	}: {
		value?: string;
		onValueChange?: (value: string) => void;
		options: { value: string; label: string }[];
		placeholder?: string;
		disabled?: boolean;
		name?: string;
		class?: string;
	} = $props();

	let selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? placeholder);
</script>

<Select.Root
	type="single"
	{name}
	{disabled}
	items={options.map((o) => ({ value: o.value, label: o.label }))}
	value={value}
	onValueChange={(v) => {
		if (v !== undefined) {
			value = v;
			onValueChange?.(v);
		}
	}}
>
	<Select.Trigger>
		{#snippet child({ props })}
			<button {...props} class="sel-trigger {className}" class:placeholder={!value}>
				<span class="sel-value">{value ? selectedLabel : placeholder}</span>
				<svg class="sel-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="6 9 12 15 18 9"></polyline>
				</svg>
			</button>
		{/snippet}
	</Select.Trigger>

	<Select.Portal>
		<Select.Content class="sel-content" sideOffset={4}>
			<Select.Viewport>
				{#snippet child({ props })}
					<div {...props}>
						{#each options as option}
							<Select.Item value={option.value} label={option.label}>
								{#snippet child({ props: itemProps, selected })}
									<div {...itemProps} class="sel-item" class:selected>
										{option.label}
									</div>
								{/snippet}
							</Select.Item>
						{/each}
					</div>
				{/snippet}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>

<style>
	.sel-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		padding: 0.5rem 0.75rem;
		font-size: 0.9rem;
		color: var(--color-foreground);
		cursor: pointer;
		text-align: left;
	}

	.sel-trigger:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: var(--shadow-focus-ring);
	}

	.sel-trigger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.sel-trigger.placeholder .sel-value {
		color: var(--color-muted);
	}

	.sel-value {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sel-chevron {
		color: var(--color-muted);
		flex-shrink: 0;
	}

	:global(.sel-content) {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		padding: 0.25rem;
		max-height: 260px;
		overflow-y: auto;
		z-index: 52;
		min-width: var(--bits-select-anchor-width);
	}

	:global(.sel-item) {
		display: flex;
		align-items: center;
		padding: 0.4rem 0.6rem;
		border-radius: var(--radius-sm);
		font-size: 0.9rem;
		cursor: pointer;
		color: var(--color-foreground);
	}

	:global(.sel-item:hover),
	:global(.sel-item[data-highlighted]) {
		background: var(--color-hover);
	}

	:global(.sel-item.selected) {
		font-weight: 600;
	}
</style>
