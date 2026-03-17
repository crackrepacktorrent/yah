<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
	}: {
		children: Snippet;
	} = $props();
</script>

<span class="badge">
	{@render children()}
</span>

<style>
	.badge {
		display: inline-block;
		background: var(--admin-border-light);
		padding: 0.15rem 0.5rem;
		border-radius: 100px;
		font-size: 0.75rem;
		color: var(--admin-muted);
	}
</style>
