<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		variant = 'primary',
		href,
		disabled = false,
		type = 'button',
		class: className = '',
		onclick,
		...rest
	}: {
		children: Snippet;
		variant?: 'primary' | 'secondary' | 'danger' | 'danger-outline' | 'ghost';
		href?: string;
		disabled?: boolean;
		type?: 'submit' | 'button' | 'reset';
		class?: string;
		onclick?: (e: Event) => void;
		[key: string]: any;
	} = $props();
</script>

{#if href && !disabled}
	<a {href} class="btn btn-{variant} {className}" {...rest}>
		{@render children()}
	</a>
{:else}
	<button {disabled} {type} {onclick} class="btn btn-{variant} {className}" {...rest}>
		{@render children()}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		font-weight: 600;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background-color 0.15s, border-color 0.15s, color 0.15s;
		text-decoration: none;
		border: none;
		padding: 0.5rem 1rem;
	}

	.btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary {
		background-color: var(--color-primary);
		color: var(--color-surface);
	}

	.btn-primary:hover:not(:disabled) {
		background-color: var(--color-primary-hover);
	}

	.btn-secondary {
		background: var(--color-surface);
		color: var(--color-foreground);
		border: 1px solid var(--color-border);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--color-hover);
	}

	.btn-danger {
		background-color: var(--color-destructive);
		color: var(--color-surface);
	}

	.btn-danger:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn-danger-outline {
		background: var(--color-surface);
		color: var(--color-destructive);
		border: 1px solid var(--color-destructive);
	}

	.btn-danger-outline:hover:not(:disabled) {
		background: var(--color-destructive-bg);
	}

	.btn-ghost {
		background: none;
		color: var(--color-muted);
		padding: 0.5rem 1rem;
	}

	.btn-ghost:hover:not(:disabled) {
		color: var(--color-foreground);
	}
</style>
