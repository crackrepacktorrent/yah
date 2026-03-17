<script lang="ts">
	import { Pagination } from 'bits-ui';

	let {
		count,
		perPage = 10,
		page = $bindable(1),
		onPageChange,
	}: {
		count: number;
		perPage?: number;
		page?: number;
		onPageChange?: (page: number) => void;
	} = $props();
</script>

<Pagination.Root {count} {perPage} bind:page {onPageChange}>
	{#snippet child({ props, pages, currentPage })}
		<nav {...props} class="pagination-nav">
			<Pagination.PrevButton>
				{#snippet child({ props: prevProps })}
					<button {...prevProps} class="pagination-btn pagination-prev">← Previous</button>
				{/snippet}
			</Pagination.PrevButton>

			<div class="pagination-pages">
				{#each pages as p}
					{#if p.type === 'ellipsis'}
						<span class="pagination-ellipsis">...</span>
					{:else}
						<Pagination.Page page={p}>
							{#snippet child({ props: pageProps })}
								<button
									{...pageProps}
									class="pagination-page"
									class:pagination-page-active={p.value === currentPage}
								>
									{p.value}
								</button>
							{/snippet}
						</Pagination.Page>
					{/if}
				{/each}
			</div>

			<Pagination.NextButton>
				{#snippet child({ props: nextProps })}
					<button {...nextProps} class="pagination-btn pagination-next">Next →</button>
				{/snippet}
			</Pagination.NextButton>
		</nav>
	{/snippet}
</Pagination.Root>

<style>
	.pagination-nav {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		margin-top: 1.5rem;
		font-size: 0.9rem;
	}

	.pagination-btn {
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 0.4rem 0.75rem;
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--color-primary);
		transition: background 0.15s;
	}

	.pagination-btn:hover:not(:disabled) {
		background: var(--color-hover);
	}

	.pagination-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		color: var(--color-muted);
	}

	.pagination-pages {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin: 0 0.5rem;
	}

	.pagination-page {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--color-muted);
		transition: background 0.15s, color 0.15s;
	}

	.pagination-page:hover {
		background: var(--color-hover);
		color: var(--color-foreground);
	}

	.pagination-page-active {
		background: var(--color-primary);
		color: var(--color-surface);
	}

	.pagination-page-active:hover {
		background: var(--color-primary-hover);
		color: var(--color-surface);
	}

	.pagination-ellipsis {
		color: var(--color-muted);
		padding: 0 0.25rem;
	}
</style>
