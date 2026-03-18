<script lang="ts" module>
	export { Combobox } from 'bits-ui';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Combobox } from 'bits-ui';

	let {
		value = $bindable(''),
		onValueChange,
		placeholder = 'Search...',
		oninput,
		children,
		class: className = '',
	}: {
		value?: string;
		onValueChange?: (value: string) => void;
		placeholder?: string;
		oninput?: (e: Event) => void;
		children: Snippet;
		class?: string;
	} = $props();

	let open = $state(false);
</script>

<Combobox.Root
	type="single"
	{value}
	onValueChange={(v) => {
		value = v ?? '';
		onValueChange?.(v ?? '');
	}}
	bind:open
>
	<div class="combobox-trigger {className}">
		<Combobox.Input
			{oninput}
			{placeholder}
		>
			{#snippet child({ props })}
				<input {...props} class="combobox-input" />
			{/snippet}
		</Combobox.Input>
		<Combobox.Trigger>
			{#snippet child({ props })}
				<button {...props} class="combobox-chevron" aria-label="Toggle list">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="6 9 12 15 18 9"></polyline>
					</svg>
				</button>
			{/snippet}
		</Combobox.Trigger>
	</div>

	<Combobox.Content class="combobox-content" sideOffset={4}>
		{@render children()}
	</Combobox.Content>
</Combobox.Root>

<style>
	.combobox-trigger {
		display: flex;
		align-items: center;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		overflow: hidden;
	}

	.combobox-trigger:focus-within {
		border-color: var(--color-primary);
		box-shadow: var(--shadow-focus-ring);
	}

	.combobox-input {
		flex: 1;
		border: none;
		background: none;
		padding: 0.5rem 0.75rem;
		font-size: 0.9rem;
		color: var(--color-foreground);
		outline: none;
		min-width: 0;
	}

	.combobox-input::placeholder {
		color: var(--color-muted);
	}

	.combobox-chevron {
		background: none;
		border: none;
		padding: 0.5rem;
		color: var(--color-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
	}

	.combobox-chevron:hover {
		color: var(--color-foreground);
	}

	:global(.combobox-content) {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		padding: 0.25rem;
		max-height: 260px;
		overflow-y: auto;
		z-index: var(--z-dropdown);
	}

	:global(.combobox-item) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.6rem;
		border-radius: var(--radius-sm);
		font-size: 0.85rem;
		cursor: pointer;
		color: var(--color-foreground);
	}

	:global(.combobox-item:hover),
	:global(.combobox-item[data-highlighted]) {
		background: var(--color-hover);
	}

	:global(.combobox-item.selected) {
		font-weight: 600;
	}

	:global(.combobox-empty) {
		padding: 0.5rem 0.6rem;
		font-size: 0.85rem;
		color: var(--color-muted);
	}
</style>
