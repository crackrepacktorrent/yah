<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Tooltip as BitsTooltip } from 'bits-ui';

	let {
		text,
		children,
	}: {
		text: string;
		children: Snippet;
	} = $props();
</script>

<BitsTooltip.Provider delayDuration={300}>
	<BitsTooltip.Root>
		<BitsTooltip.Trigger>
			{#snippet child({ props })}
				<span {...props} class="tooltip-trigger">
					{@render children()}
				</span>
			{/snippet}
		</BitsTooltip.Trigger>
		<BitsTooltip.Portal>
			<BitsTooltip.Content>
				{#snippet child({ props })}
					<div {...props} class="tooltip-content">
						{text}
					</div>
				{/snippet}
			</BitsTooltip.Content>
		</BitsTooltip.Portal>
	</BitsTooltip.Root>
</BitsTooltip.Provider>

<style>
	.tooltip-trigger {
		display: inline;
		cursor: default;
	}

	.tooltip-content {
		background: var(--color-foreground);
		color: var(--color-surface);
		padding: 0.4rem 0.75rem;
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
		max-width: 400px;
		word-break: break-all;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: var(--z-tooltip);
	}
</style>
