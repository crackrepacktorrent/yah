<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		class: className = '',
		value = $bindable(''),
		...rest
	}: HTMLInputAttributes & { class?: string; value?: string } = $props();
</script>

<input class="admin-input {className}" bind:value {...rest} />

<style>
	.admin-input {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.9rem;
		background: var(--color-input-bg);
		color: var(--color-foreground);
		transition: border-color 0.15s;
		width: 100%;
	}

	.admin-input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: var(--shadow-focus-ring);
	}
</style>
