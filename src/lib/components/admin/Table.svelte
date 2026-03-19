<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		toolbar,
	}: {
		children: Snippet;
		toolbar?: Snippet;
	} = $props();
</script>

<div class="admin-table-outer">
	{#if toolbar}
		<div class="admin-table-toolbar">
			{@render toolbar()}
		</div>
	{/if}
	<div class="admin-table-wrapper">
		<table class="admin-table">
			{@render children()}
		</table>
	</div>
</div>

<style>
	.admin-table-outer {
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		background: var(--color-surface);
		overflow: hidden;
	}

	.admin-table-wrapper {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.admin-table-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.625rem 1rem;
		min-height: 3rem;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}

	/* ─── Shared toolbar inner styles ─────────────────────────────────── */

	.admin-table-toolbar :global(.toolbar-count) {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-foreground);
		white-space: nowrap;
	}

	.admin-table-toolbar :global(.toolbar-actions) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.admin-table-toolbar :global(.toolbar-clear) {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-muted);
		font-size: 0.8rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
	}

	.admin-table-toolbar :global(.toolbar-clear:hover) {
		color: var(--color-foreground);
		background: var(--color-hover);
	}

	.admin-table-toolbar :global(.toolbar-search) {
		display: flex;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
	}

	.admin-table-toolbar :global(.toolbar-spacer) {
		flex: 1;
	}

	@media (max-width: 640px) {
		.admin-table-toolbar {
			flex-wrap: wrap;
		}

		.admin-table-toolbar :global(.toolbar-search) {
			flex-basis: 100%;
		}
	}

	/* ─── Table ────────────────────────────────────────────────────────── */

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
		background: var(--color-surface);
	}

	.admin-table :global(tr:last-child td) {
		border-bottom: none;
	}

	.admin-table :global(tbody tr:hover) {
		background: var(--color-hover);
	}
</style>
