<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		children,
		maxWidth,
		class: className = '',
		...rest
	}: HTMLAttributes<HTMLDivElement> & {
		children: Snippet;
		maxWidth?: string;
	} = $props();
</script>

<div class="admin-card {className}" style:max-width={maxWidth} {...rest}>
	{@render children()}
</div>

<style>
	.admin-card {
		background: #fff;
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		box-shadow: var(--admin-shadow);
	}
</style>
