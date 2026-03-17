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
		overflow: hidden;
		border-radius: var(--radius-lg);
		box-shadow: var(--admin-shadow);
	}

	.admin-table {
		width: 100%;
		background: #fff;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.admin-table :global(th) {
		text-align: left;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--admin-border-medium);
		font-weight: 600;
		color: var(--admin-muted);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		background: var(--admin-bg);
	}

	.admin-table :global(td) {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--admin-border-light);
		color: var(--color-yahblack);
	}

	.admin-table :global(tr:last-child td) {
		border-bottom: none;
	}
</style>
