<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		variant = 'default',
	}: {
		children: Snippet;
		variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
	} = $props();
</script>

<span class="badge badge-{variant}">
	{@render children()}
</span>

<style>
	.badge {
		display: inline-block;
		padding: 0.15rem 0.5rem;
		border-radius: 100px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.badge-default {
		background: var(--brand-olive-muted);
		color: var(--brand-olive-dark);
	}

	.badge-success {
		background: var(--color-success-bg);
		color: var(--color-success);
	}

	.badge-error {
		background: var(--color-destructive-bg);
		color: var(--color-destructive);
	}

	.badge-warning {
		background: var(--color-warning-bg);
		color: var(--brand-amber-dark);
	}

	.badge-info {
		background: var(--brand-amber-lighter);
		color: var(--brand-brown);
	}
</style>
