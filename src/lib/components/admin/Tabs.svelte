<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Tabs } from 'bits-ui';

	let {
		value = $bindable(''),
		tabs,
		children,
	}: {
		value?: string;
		tabs: { value: string; label: string }[];
		children: Snippet;
	} = $props();
</script>

<Tabs.Root bind:value>
	<Tabs.List>
		{#snippet child({ props })}
			<div {...props} class="tabs-list">
				{#each tabs as tab}
					<Tabs.Trigger value={tab.value}>
						{#snippet child({ props: triggerProps })}
							<button {...triggerProps} class="tab-trigger" class:active={value === tab.value}>{tab.label}</button>
						{/snippet}
					</Tabs.Trigger>
				{/each}
			</div>
		{/snippet}
	</Tabs.List>
	{@render children()}
</Tabs.Root>

<style>
	.tabs-list {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--color-border);
		margin-bottom: 1.25rem;
	}

	.tab-trigger {
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		color: var(--color-muted);
		font-size: 0.9rem;
		font-weight: 500;
		padding: 0.5rem 1rem;
		transition: all 0.15s ease;
	}

	.tab-trigger:hover {
		color: var(--color-foreground);
	}

	.tab-trigger.active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}
</style>
