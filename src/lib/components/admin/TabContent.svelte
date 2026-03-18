<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Tabs } from 'bits-ui';

	let {
		value,
		children,
	}: {
		value: string;
		children: Snippet;
	} = $props();
</script>

<Tabs.Content {value}>
	{#snippet child({ props })}
		<div {...props} class="tab-content">
			{@render children()}
		</div>
	{/snippet}
</Tabs.Content>

<style>
	.tab-content {
		min-height: 0;
	}
</style>
