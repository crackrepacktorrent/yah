<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		variant = 'primary',
		href,
		disabled = false,
		type,
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

{#if href}
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

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary {
		background-color: var(--color-yahrange);
		color: #fff;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: var(--admin-primary-hover);
	}

	.btn-secondary {
		background: #fff;
		color: var(--color-yahblack);
		border: 1px solid var(--admin-border);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--admin-border-light);
	}

	.btn-danger {
		background-color: var(--destructive);
		color: #fff;
	}

	.btn-danger:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn-danger-outline {
		background: #fff;
		color: var(--destructive);
		border: 1px solid var(--destructive);
	}

	.btn-danger-outline:hover:not(:disabled) {
		background: var(--destructive-bg);
	}

	.btn-ghost {
		background: none;
		color: var(--admin-muted);
		padding: 0.5rem 1rem;
	}

	.btn-ghost:hover:not(:disabled) {
		color: var(--color-yahblack);
	}
</style>
