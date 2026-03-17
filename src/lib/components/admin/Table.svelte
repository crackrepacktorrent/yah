<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
	}: {
		children: Snippet;
	} = $props();
</script>

<div class="admin-table-wrapper">
	<table class="admin-table">
		{@render children()}
	</table>
</div>

<style>
	.admin-table-wrapper {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
	}

	.admin-table {
		width: 100%;
		background: var(--color-surface);
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.admin-table :global(th) {
		text-align: left;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-border-medium);
		font-weight: 600;
		color: var(--color-muted);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		background: var(--color-input-bg);
	}

	.admin-table :global(td) {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-border-light);
		color: var(--color-foreground);
	}

	.admin-table :global(tr:last-child td) {
		border-bottom: none;
	}

	.admin-table :global(tbody tr:hover) {
		background: var(--color-hover);
	}
</style>
