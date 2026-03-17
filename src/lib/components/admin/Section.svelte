<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		children,
		class: className = '',
	}: {
		title: string;
		children: Snippet;
		class?: string;
	} = $props();
</script>

<div class="admin-section {className}">
	<h3 class="admin-section-title">{title}</h3>
	{@render children()}
</div>

<style>
	.admin-section {
		display: flex;
		flex-direction: column;
	}

	.admin-section-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
		margin: 0 0 0.5rem;
		flex-shrink: 0;
	}
</style>
