import { createAsync, revalidate, type RouteDefinition } from '@solidjs/router';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { toast } from 'solid-sonner';
import {
	Badge, Button, EmptyState, PageHeader, Section,
} from '~/components';
import { requireSession } from '~/routes/admin/session';
import { can } from '~/lib/can';
import { toastError } from '~/lib/utils';
import { listLists, updateList } from '../lists.server';
import './index.css';

export const route: RouteDefinition = {
	preload: () => { void listLists(); },
};

type ListItem = {
	id: number;
	uuid: string;
	name: string;
	type: 'public' | 'private';
	optin: 'single' | 'double';
	subscriber_count: number;
};

export default function FormsPage() {
	const session = createAsync(() => requireSession());
	const data = createAsync(() => listLists());

	const [pendingToggle, setPendingToggle] = createSignal<number | null>(null);
	const [copiedId, setCopiedId] = createSignal<string | null>(null);

	const publicLists = createMemo(() => (data()?.lists ?? []).filter((l) => l.type === 'public') as ListItem[]);
	const privateLists = createMemo(() => (data()?.lists ?? []).filter((l) => l.type === 'private') as ListItem[]);

	async function toggleListType(list: ListItem) {
		setPendingToggle(list.id);
		try {
			const newType = list.type === 'public' ? 'private' : 'public';
			await updateList({ id: list.id, name: list.name, type: newType, optin: list.optin });
			toast.success(`"${list.name}" is now ${newType}.`);
			await revalidate('listLists');
		} catch (err) {
			toastError(err, 'Failed to update list.');
		} finally {
			setPendingToggle(null);
		}
	}

	function getSubscribeUrl(listUuid: string) {
		return `/subscribe?list=${listUuid}`;
	}

	function getEmbedSnippet(listUuid: string, listName: string) {
		return `<form method="post" action="/subscribe">
  <input type="email" name="email" required placeholder="Your email" />
  <input type="text" name="name" placeholder="Your name" />
  <input type="hidden" name="list" value="${listUuid}" />
  <button type="submit">Subscribe to ${listName}</button>
</form>`;
	}

	async function copySnippet(listUuid: string, listName: string) {
		try {
			await navigator.clipboard.writeText(getEmbedSnippet(listUuid, listName));
			setCopiedId(listUuid);
			setTimeout(() => setCopiedId(null), 2000);
		} catch {
			toast.error('Failed to copy to clipboard.');
		}
	}

	return (
		<>
			<PageHeader title="Subscription Forms" />

			<Show when={data()}>
				<div class="public-url">
					<span class="url-label">Public subscription page:</span>
					<a href="/subscribe" target="_blank" rel="noopener" class="url-link">/subscribe</a>
					<span class="url-hint">(shows all public lists)</span>
				</div>

				<div class="section-stack">
					<Section title="Public Lists">
						<Show
							when={publicLists().length > 0}
							fallback={<EmptyState message="No public lists. Make a list public to generate subscription forms." />}
						>
							<div class="form-cards">
								<For each={publicLists()}>
									{(list) => (
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
													<a href={getSubscribeUrl(list.uuid)} target="_blank" rel="noopener" class="preview-link">Preview</a>
													<Show when={can(session(), 'list', 'edit')}>
														<Button
															variant="ghost"
															onClick={() => toggleListType(list)}
															disabled={pendingToggle() === list.id}
														>
															{pendingToggle() === list.id ? '…' : 'Make Private'}
														</Button>
													</Show>
												</div>
											</div>
											<div class="embed-section">
												<div class="embed-header">
													<span class="embed-label">Embed code</span>
													<button class="copy-btn" onClick={() => copySnippet(list.uuid, list.name)}>
														{copiedId() === list.uuid ? 'Copied!' : 'Copy'}
													</button>
												</div>
												<pre class="embed-code">{getEmbedSnippet(list.uuid, list.name)}</pre>
											</div>
										</div>
									)}
								</For>
							</div>
						</Show>
					</Section>

					<Show when={privateLists().length > 0}>
						<Section title="Private Lists">
							<div class="private-lists">
								<For each={privateLists()}>
									{(list) => (
										<div class="private-list-row">
											<div class="private-list-info">
												<span class="private-list-name">{list.name}</span>
												<Badge>private</Badge>
												<span class="subscriber-count">{list.subscriber_count} subscriber{list.subscriber_count !== 1 ? 's' : ''}</span>
											</div>
											<Show when={can(session(), 'list', 'edit')}>
												<Button
													variant="ghost"
													onClick={() => toggleListType(list)}
													disabled={pendingToggle() === list.id}
												>
													{pendingToggle() === list.id ? '…' : 'Make Public'}
												</Button>
											</Show>
										</div>
									)}
								</For>
							</div>
						</Section>
					</Show>
				</div>
			</Show>
		</>
	);
}
