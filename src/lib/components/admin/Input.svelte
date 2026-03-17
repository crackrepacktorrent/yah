<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		class: className = '',
		...rest
	}: HTMLInputAttributes & { class?: string } = $props();
</script>

<input class="admin-input {className}" {...rest} />

<style>
	.admin-input {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--admin-border);
		border-radius: var(--radius-md);
		font-size: 0.9rem;
		background: var(--admin-bg);
		color: var(--color-yahblack);
		transition: border-color 0.15s;
		width: 100%;
	}

	.admin-input:focus {
		outline: none;
		border-color: var(--color-yahrange);
		box-shadow: var(--admin-focus-ring);
	}
</style>
