import { revalidate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { For, Show, createMemo, createSignal } from 'solid-js';
import type { MailingList } from '~/features/mailing-lists/contracts';
import { mailingListKindLabel, mailingListStatusLabel } from '~/features/mailing-lists/form';
import { mailingListHref } from '~/features/mailing-lists/routing';
import {
	getSubscriptionSharingConfig,
	listMailingLists,
	setMailingListVisibility,
} from '~/features/mailing-lists/server';
import {
	subscriptionEmbedSnippet,
	subscriptionPageUrl,
} from '~/features/mailing-lists/subscription-sharing';
import { requireSession } from '~/platform/auth/session';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/emails/forms', {
	preload: () => {
		void listMailingLists();
		void getSubscriptionSharingConfig();
	},
});

export default function SubscriptionSharingPage() {
	const lists = createMemo(() => listMailingLists());
	const config = createMemo(() => getSubscriptionSharingConfig());
	const session = createMemo(() => requireSession());
	const canEdit = createMemo(() => session().permissions['list']?.includes('edit') ?? false);
	const publicLists = createMemo(() => lists().filter((list) => list.kind === 'public' && list.status === 'active'));
	const otherLists = createMemo(() => lists().filter((list) => list.kind !== 'public' || list.status !== 'active'));
	const [pendingId, setPendingId] = createSignal<number | null>(null);
	const [error, setError] = createSignal('');
	const [copiedUuid, setCopiedUuid] = createSignal('');

	async function changeVisibility(list: MailingList, makePublic: boolean): Promise<void> {
		setPendingId(list.id);
		setError('');
		try {
			await setMailingListVisibility({ id: list.id, expectedUpdatedAt: list.updatedAt, public: makePublic });
			revalidate(listMailingLists.key);
			toast.success(makePublic ? `${list.name} published.` : `${list.name} made private.`);
		} catch (caught) {
			setError(visibleError(caught, 'The mailing-list visibility could not be changed.'));
		} finally {
			setPendingId(null);
		}
	}

	async function copySnippet(uuid: string, name: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(subscriptionEmbedSnippet(config().publicSiteUrl, uuid, name));
			setCopiedUuid(uuid);
			setTimeout(() => setCopiedUuid((current) => current === uuid ? '' : current), 2_000);
		} catch {
			setError('The embed code could not be copied. Select and copy it manually.');
		}
	}

	return (
		<section class="subscription-sharing-page">
			<header class="page-header"><div><p class="eyebrow">Email audiences</p><h1>Subscription forms</h1></div></header>
			<p>Public submission stays on the web application. This page controls which active lists are published and generates safe, list-scoped embeds.</p>
			<p><a href={subscriptionPageUrl(config().publicSiteUrl)} target="_blank" rel="noreferrer">Open the public subscription page</a></p>
			<Show when={error()}>{(message) => <p class="field-error" role="alert">{message()}</p>}</Show>
			<p class="visually-hidden" role="status" aria-live="polite">{copiedUuid() ? 'Embed code copied.' : ''}</p>

			<section class="subscription-sharing-section" aria-labelledby="published-lists-heading">
				<h2 id="published-lists-heading">Published lists</h2>
				<Show when={publicLists().length > 0} fallback={<p>No active public lists are currently published.</p>}>
					<div class="subscription-card-list">
						<For each={publicLists()}>{(list) => {
							const snippet = () => subscriptionEmbedSnippet(config().publicSiteUrl, list.uuid, list.name);
							return (
								<article class="subscription-card">
									<header><div><h3>{list.name}</h3><p>{list.optIn === 'double' ? 'Double' : 'Single'} opt-in · {list.subscriberCount} subscribers</p></div>
										<div class="subscription-card-actions">
											<a class="button button--secondary" href={subscriptionPageUrl(config().publicSiteUrl, list.uuid)} target="_blank" rel="noreferrer">Preview</a>
											<Show when={canEdit()}><button class="button button--secondary" type="button" disabled={pendingId() === list.id} onClick={() => void changeVisibility(list, false)}>{pendingId() === list.id ? 'Updating…' : 'Make private'}</button></Show>
										</div>
									</header>
									<div class="subscription-embed-header"><strong>List-scoped embed code</strong><button type="button" onClick={() => void copySnippet(list.uuid, list.name)}>{copiedUuid() === list.uuid ? 'Copied' : 'Copy'}</button></div>
									<pre class="subscription-embed"><code>{snippet()}</code></pre>
								</article>
							);
						}}</For>
					</div>
				</Show>
			</section>

			<section class="subscription-sharing-section" aria-labelledby="unpublished-lists-heading">
				<h2 id="unpublished-lists-heading">Unpublished and provider-managed lists</h2>
				<div class="data-table-scroll">
					<table class="data-table">
						<caption class="visually-hidden">Lists without active public forms</caption>
						<thead><tr><th scope="col">Name</th><th scope="col">Visibility</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
						<tbody>
							<Show when={otherLists().length > 0} fallback={<tr><td colspan="4">Every list is currently published.</td></tr>}>
								<For each={otherLists()}>{(list) => (
									<tr>
										<td><a href={mailingListHref(list.id)}>{list.name}</a></td>
										<td>{mailingListKindLabel(list.kind)}</td>
										<td>{mailingListStatusLabel(list.status)}</td>
										<td>
											<Show
												when={canEdit() && list.kind === 'private' && list.status === 'active'}
												fallback={list.status === 'archived' ? 'Reactivate from its list detail.' : 'Provider-managed in Listmonk.'}
											>
												<button class="button button--secondary" type="button" disabled={pendingId() === list.id} onClick={() => void changeVisibility(list, true)}>{pendingId() === list.id ? 'Publishing…' : 'Publish'}</button>
											</Show>
										</td>
									</tr>
								)}</For>
							</Show>
						</tbody>
					</table>
				</div>
			</section>
		</section>
	);
}
