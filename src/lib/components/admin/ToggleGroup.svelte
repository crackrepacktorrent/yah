<script lang="ts">
	import { ToggleGroup } from 'bits-ui';

	let {
		value = $bindable(''),
		onValueChange,
		options,
	}: {
		value?: string;
		onValueChange?: (value: string) => void;
		options: { value: string; label: string }[];
	} = $props();
</script>

<ToggleGroup.Root
	type="single"
	{value}
	onValueChange={(v) => {
		if (v) {
			value = v;
			onValueChange?.(v);
		}
	}}
>
	{#snippet child({ props })}
		<div {...props} class="toggle-group">
			{#each options as option}
				<ToggleGroup.Item value={option.value}>
					{#snippet child({ props: itemProps })}
						<button {...itemProps} class="toggle-item" class:active={value === option.value}>{option.label}</button>
					{/snippet}
				</ToggleGroup.Item>
			{/each}
		</div>
	{/snippet}
</ToggleGroup.Root>

<style>
	.toggle-group {
		display: flex;
		gap: 2px;
		background: var(--color-border);
		border-radius: var(--radius-md);
		padding: 2px;
	}

	.toggle-item {
		background: none;
		border: none;
		padding: 0.35rem 0.75rem;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--color-muted);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.15s;
	}

	.toggle-item.active {
		background: var(--color-surface);
		color: var(--color-foreground);
		box-shadow: var(--shadow-sm);
	}

	.toggle-item:hover:not(.active) {
		color: var(--color-foreground);
	}
</style>
