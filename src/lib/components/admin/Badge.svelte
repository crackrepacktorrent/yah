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
	}

	.badge-default {
		background: var(--color-border-light);
		color: var(--color-muted);
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
		background: #fef3c7;
		color: #92400e;
	}

	.badge-info {
		background: #dbeafe;
		color: #1e40af;
	}
</style>
