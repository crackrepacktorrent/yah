<script lang="ts">
	import { Badge, Button, EmptyState, Spinner, Section } from '$lib/components/admin';
	import { toast } from 'svelte-sonner';
	import { listLists, updateList } from '../lists.remote';
	import { getSession } from '../../session.remote';
	import { can } from '../../can';

	let session = $derived(getSession().current);
	let listsQuery = $derived(listLists());
	let _prev: typeof listsQuery.current;
	let listsData = $derived.by(() => {
		const val = listsQuery.current;
		if (val !== undefined) _prev = val;
		return val ?? _prev;
	});

	let publicLists = $derived(listsData?.lists.filter((l) => l.type === 'public') ?? []);
	let privateLists = $derived(listsData?.lists.filter((l) => l.type === 'private') ?? []);

	let pendingToggle = $state<number | null>(null);

	async function toggleListType(list: { id: number; name: string; type: 'public' | 'private'; optin: 'single' | 'double' }) {
		pendingToggle = list.id;
		try {
			const newType = list.type === 'public' ? 'private' : 'public';
			await updateList({ id: list.id, type: newType });
			toast.success(`"${list.name}" is now ${newType}.`);
			listLists().refresh();
		} catch (err: any) {
			toast.error(err?.message || 'Failed to update list.');
		} finally {
			pendingToggle = null;
		}
	}

	function getSubscribeUrl(listId: number): string {
		return `/subscribe?list=${listId}`;
	}

	function getEmbedSnippet(listId: number, listName: string): string {
		return `<form method="post" action="/subscribe">
  <input type="email" name="email" required placeholder="Your email" />
  <input type="text" name="name" placeholder="Your name" />
  <input type="hidden" name="list" value="${listId}" />
  <button type="submit">Subscribe to ${listName}</button>
</form>`;
	}

	let copiedId = $state<number | null>(null);

	async function copySnippet(listId: number, listName: string) {
		try {
			await navigator.clipboard.writeText(getEmbedSnippet(listId, listName));
			copiedId = listId;
			setTimeout(() => { copiedId = null; }, 2000);
		} catch {
			toast.error('Failed to copy to clipboard.');
		}
	}
</script>

<h1>Subscription Forms</h1>

{#if !listsData && listsQuery.loading}
	<Spinner size={48} centered />
{:else if listsData}
	<div class="public-url">
		<span class="url-label">Public subscription page:</span>
		<a href="/subscribe" target="_blank" rel="noopener" class="url-link">/subscribe</a>
		<span class="url-hint">(shows all public lists)</span>
	</div>

	<div class="section-stack">
		<Section title="Public Lists">
			{#if publicLists.length > 0}
				<div class="form-cards">
					{#each publicLists as list}
						<div class="form-card">
							<div class="form-card-header">
								<div class="form-card-info">
									<span class="form-card-name">{list.name}</span>
									<div class="form-card-meta">
										<Badge variant="info">public</Badge>
										<Badge variant={list.optin === 'double' ? 'warning' : 'success'}>{list.optin} opt-in</Badge>
										<span class="subscriber-count">{list.subscriber_count} subscriber{list.subscriber_count !== 1 ? 's' : ''}</span>
									</div>
								</div>
								<div class="form-card-actions">
									<a href={getSubscribeUrl(list.id)} target="_blank" rel="noopener" class="preview-link">Preview</a>
									{#if can(session, 'list', 'edit')}
										<Button
											variant="ghost"
											onclick={() => toggleListType(list)}
											disabled={pendingToggle === list.id}
										>
											{pendingToggle === list.id ? '...' : 'Make Private'}
										</Button>
									{/if}
								</div>
							</div>

							<div class="embed-section">
								<div class="embed-header">
									<span class="embed-label">Embed code</span>
									<button class="copy-btn" onclick={() => copySnippet(list.id, list.name)}>
										{copiedId === list.id ? 'Copied!' : 'Copy'}
									</button>
								</div>
								<pre class="embed-code">{getEmbedSnippet(list.id, list.name)}</pre>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<EmptyState message="No public lists. Make a list public to generate subscription forms." />
			{/if}
		</Section>

		{#if privateLists.length > 0}
			<Section title="Private Lists">
				<div class="private-lists">
					{#each privateLists as list}
						<div class="private-list-row">
							<div class="private-list-info">
								<span class="private-list-name">{list.name}</span>
								<Badge>private</Badge>
								<span class="subscriber-count">{list.subscriber_count} subscriber{list.subscriber_count !== 1 ? 's' : ''}</span>
							</div>
							{#if can(session, 'list', 'edit')}
								<Button
									variant="ghost"
									onclick={() => toggleListType(list)}
									disabled={pendingToggle === list.id}
								>
									{pendingToggle === list.id ? '...' : 'Make Public'}
								</Button>
							{/if}
						</div>
					{/each}
				</div>
			</Section>
		{/if}
	</div>
{/if}

<style>

	.public-url {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		margin-bottom: 1.5rem;
		font-size: 0.9rem;
	}

	.url-label {
		color: var(--color-muted);
		white-space: nowrap;
	}

	.url-link {
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 600;
	}

	.url-link:hover {
		text-decoration: underline;
	}

	.url-hint {
		color: var(--color-muted);
		font-size: 0.8rem;
	}

	.form-cards {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 1.25rem;
	}

	.form-card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 1rem;
		gap: 1rem;
	}

	.form-card-info {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.form-card-name {
		font-weight: 600;
		color: var(--color-foreground);
		font-size: 1rem;
	}

	.form-card-meta {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.form-card-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.preview-link {
		color: var(--color-primary);
		font-size: 0.85rem;
		text-decoration: none;
		white-space: nowrap;
	}

	.preview-link:hover {
		text-decoration: underline;
	}

	.subscriber-count {
		color: var(--color-muted);
		font-size: 0.8rem;
	}

	.embed-section {
		border-top: 1px solid var(--color-border);
		padding-top: 0.75rem;
	}

	.embed-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.embed-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.copy-btn {
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		color: var(--color-primary);
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
	}

	.copy-btn:hover {
		background: var(--color-hover);
	}

	.embed-code {
		background: var(--color-page-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 0.75rem;
		font-size: 0.75rem;
		line-height: 1.5;
		overflow-x: auto;
		white-space: pre;
		color: var(--color-foreground);
		margin: 0;
	}

	.private-lists {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.private-list-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		gap: 1rem;
	}

	.private-list-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.private-list-name {
		font-weight: 600;
		color: var(--color-foreground);
	}

	@media (max-width: 768px) {
		.public-url {
			flex-direction: column;
			align-items: flex-start;
		}

		.form-card-header {
			flex-direction: column;
		}

		.private-list-row {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
