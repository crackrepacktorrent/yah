import { can } from '@yah/admin-core/permissions';
import { revalidate, useNavigate, useSearchParams } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { For, Loading, Show, createEffect, createMemo, createSignal, untrack } from 'solid-js';
import { MAX_BULK_SUBSCRIBER_SELECTION, type SubscriberPage } from '~/features/subscribers/contracts';
import { decodeSubscriberListLocation, subscriberHref, subscriberListHref } from '~/features/subscribers/routing';
import { blocklistSubscribers, deleteSubscribers, listSubscribers } from '~/features/subscribers/server';
import { requireSession } from '~/platform/auth/session';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { createCommandTask } from '~/ui/command-task';
import { PageHeader } from '~/ui/page-header';
import { Pagination } from '~/ui/pagination';
import { createRowSelection } from '~/ui/row-selection';
import { SelectionCheckbox } from '~/ui/selection-checkbox';
import { toast } from '~/ui/toast';

export const route = defineFileRoute('/emails/subscribers', {
	preload: ({ location }) => void listSubscribers(decodeSubscriberListLocation(location.query)),
});

export default function SubscriberListPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const request = createMemo(() => decodeSubscriberListLocation(searchParams));
	const page = createMemo(() => listSubscribers(request()));
	const session = createMemo(() => requireSession());
	const canCreate = createMemo(() => can(session(), 'subscriber', 'create'));
	const [search, setSearch] = createSignal(untrack(() => request().search));
	const requestIdentity = createMemo(() => subscriberListHref(request()));

	createEffect(
		() => request().search,
		(resolvedSearch, previousSearch) => {
			if (previousSearch !== undefined && resolvedSearch !== previousSearch) setSearch(resolvedSearch);
		},
	);

	function submitSearch(event: SubmitEvent): void {
		event.preventDefault();
		navigate(subscriberListHref({ search: search() }));
	}

	return (
		<section class="subscribers-page">
			<PageHeader eyebrow="Email delivery" title="Subscribers">
				<Show when={canCreate()}><a class="button" href="/emails/subscribers/new">New subscriber</a></Show>
			</PageHeader>
			<form class="subscriber-search" role="search" action="/emails/subscribers" method="get" onSubmit={submitSearch}>
				<label class="filter-field"><span>Search subscribers</span><input type="search" name="search" value={search()} onInput={(event) => setSearch(event.currentTarget.value)} maxlength={200} placeholder="Email or name" /></label>
				<button class="button button--secondary" type="submit">Search</button>
				<Show when={request().search}><a class="button button--secondary" href="/emails/subscribers">Clear</a></Show>
			</form>
			<p class="subscriber-order-note">Newest subscribers first</p>
			<Loading on={requestIdentity()} fallback={<p class="table-loading" role="status">Loading subscribers…</p>}>
				<Show when={page()}>{(resolved) => <SubscriberResults page={resolved()} />}</Show>
			</Loading>
		</section>
	);
}

function SubscriberResults(props: { page: SubscriberPage }) {
	const navigate = useNavigate();
	const session = createMemo(() => requireSession());
	const canDelete = createMemo(() => can(session(), 'subscriber', 'delete'));
	const canBlocklist = createMemo(() => can(session(), 'subscriber', 'blocklist'));
	const [searchParams] = useSearchParams();
	const [dialog, setDialog] = createSignal<'delete' | 'blocklist' | null>(null);
	const mutationTask = createCommandTask();
	const selectable = createMemo(() => props.page.items.filter((subscriber) => canDelete() || (canBlocklist() && subscriber.status !== 'blocklisted')));
	const selection = createRowSelection(selectable, { limit: MAX_BULK_SUBSCRIBER_SELECTION, scope: () => `${props.page.page}:${props.page.search}` });
	const blocklistSelection = createMemo(() => selection.selected().filter((subscriber) => subscriber.status !== 'blocklisted'));

	createEffect(
		() => ({ requested: decodeSubscriberListLocation(searchParams), resolvedPage: props.page.page, resolvedSearch: props.page.search }),
		({ requested, resolvedPage, resolvedSearch }) => {
			// Canonicalize only after the response belongs to the current search.
			if (requested.search === resolvedSearch && requested.page !== resolvedPage) {
				navigate(subscriberListHref({ page: resolvedPage, search: resolvedSearch }), { replace: true });
			}
		},
	);

	async function mutateSelection(): Promise<void> {
		const operation = dialog();
		if (!operation) return;
		const subscribers = (operation === 'blocklist' ? blocklistSelection() : selection.selected()).map((subscriber) => ({
			id: subscriber.id,
			expectedUpdatedAt: subscriber.updatedAt,
		}));
		await mutationTask.run(async () => {
			if (operation === 'blocklist') await blocklistSubscribers({ subscribers });
			else await deleteSubscribers({ subscribers });
			setDialog(null);
			selection.clear();
			revalidate(listSubscribers.key);
			toast.success(operation === 'blocklist' ? 'Subscribers blocklisted.' : 'Subscribers deleted.');
		}, `The selected subscribers could not be ${operation === 'blocklist' ? 'blocklisted' : 'deleted'}.`);
	}

	return (
		<>
			<Show when={selection.selected().length > 0}>
				<div class="bulk-actions subscriber-selection" role="status">
					<span>{selection.selected().length} subscriber{selection.selected().length === 1 ? '' : 's'} selected on this page</span>
					<Show when={canBlocklist() && blocklistSelection().length > 0}><button class="button button--danger-secondary" type="button" onClick={() => { mutationTask.clearError(); setDialog('blocklist'); }}>Blocklist {blocklistSelection().length}</button></Show>
					<Show when={canDelete()}><button class="button button--danger-secondary" type="button" onClick={() => { mutationTask.clearError(); setDialog('delete'); }}>Delete selected</button></Show>
					<button class="button button--secondary" type="button" onClick={selection.clear}>Clear</button>
				</div>
			</Show>
			<div class="data-table-scroll">
				<table class="data-table">
					<caption class="visually-hidden">Subscribers in fixed provider order</caption>
					<thead><tr><th scope="col"><SelectionCheckbox label="Select all actionable subscribers on this page" checked={selection.all()} indeterminate={selection.some()} disabled={selectable().length === 0} onChange={(event) => selection.setAll(event.currentTarget.checked)} /></th><th scope="col">Subscriber</th><th scope="col">Status</th><th scope="col">Updated</th></tr></thead>
					<tbody>
						<Show when={props.page.items.length > 0} fallback={<tr><td colspan="4">No subscribers match this search.</td></tr>}>
							<For each={props.page.items}>{(subscriber) => <tr><td><SelectionCheckbox label={`Select ${subscriber.email}`} checked={selection.has(subscriber.id)} disabled={!canDelete() && (!canBlocklist() || subscriber.status === 'blocklisted')} onChange={(event) => selection.toggle(subscriber.id, event.currentTarget.checked)} /></td><td><div class="subscriber-name-cell"><a href={subscriberHref(subscriber.id)}>{subscriber.email}</a><small>{subscriber.name || 'No name'}</small></div></td><td><span class={`badge subscriber-status subscriber-status--${subscriber.status}`}>{subscriber.status}</span></td><td>{new Date(subscriber.updatedAt).toLocaleString()}</td></tr>}</For>
						</Show>
					</tbody>
				</table>
			</div>
			<Pagination label="Subscriber pages" page={props.page.page} pageSize={props.page.pageSize} total={props.page.total}
				href={(page) => subscriberListHref({ page, search: props.page.search })} />
			<ConfirmDialog open={dialog() === 'blocklist'} title="Blocklist selected subscribers?" description={`Blocklist ${blocklistSelection().length} subscriber${blocklistSelection().length === 1 ? '' : 's'}? Listmonk will unsubscribe all of their memberships. Restoring them requires a separate recovery workflow.`} confirmLabel="Blocklist subscribers" pending={mutationTask.pending()} error={mutationTask.error()} onConfirm={() => void mutateSelection()} onOpenChange={(open) => { if (!open) setDialog(null); }} />
			<ConfirmDialog open={dialog() === 'delete'} title="Delete selected subscribers?" description={`Permanently delete ${selection.selected().length} subscriber${selection.selected().length === 1 ? '' : 's'} and their Listmonk history? This cannot be undone.`} confirmLabel="Delete subscribers" pending={mutationTask.pending()} error={mutationTask.error()} onConfirm={() => void mutateSelection()} onOpenChange={(open) => { if (!open) setDialog(null); }} />
		</>
	);
}
