<script lang="ts">
	let {
		items,
	}: {
		items: { label: string; href?: string }[];
	} = $props();
</script>

<nav class="breadcrumb" aria-label="Breadcrumb">
	<ol>
		{#each items as item, i}
			{#if i > 0}
				<li class="separator" aria-hidden="true">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="9 18 15 12 9 6"></polyline>
					</svg>
				</li>
			{/if}
			<li>
				{#if item.href && i < items.length - 1}
					<a href={item.href}>{item.label}</a>
				{:else}
					<span class="current">{item.label}</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	.breadcrumb ol {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		list-style: none;
		padding: 0;
		margin: 0 0 1rem;
		font-size: 0.85rem;
	}

	.breadcrumb a {
		color: var(--color-muted);
		text-decoration: none;
		transition: color 0.15s;
	}

	.breadcrumb a:hover {
		color: var(--color-primary);
	}

	.separator {
		color: var(--color-muted);
		display: flex;
		align-items: center;
	}

	.current {
		color: var(--color-foreground);
		font-weight: 500;
	}
</style>
