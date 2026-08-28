import { can } from '@yah/admin-core/permissions';
import { revalidate, useNavigate, useSearchParams } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { For, Loading, Show, createEffect, createMemo, createSignal, untrack } from 'solid-js';
import { MAX_BULK_SUBSCRIBER_SELECTION, type SubscriberPage, type SubscriberSummary } from '~/features/subscribers/contracts';
import { decodeSubscriberListLocation, subscriberHref, subscriberListHref } from '~/features/subscribers/routing';
import { blocklistSubscribers, deleteSubscribers, listSubscribers } from '~/features/subscribers/server';
import { requireSession } from '~/platform/auth/session';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { PageHeader } from '~/ui/page-header';
import { SelectionCheckbox } from '~/ui/selection-checkbox';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

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

function statusClass(status: SubscriberSummary['status']): string {
	return `badge subscriber-status subscriber-status--${status}`;
}

function SubscriberResults(props: { page: SubscriberPage }) {
	const navigate = useNavigate();
	const session = createMemo(() => requireSession());
	const canDelete = createMemo(() => can(session(), 'subscriber', 'delete'));
	const canBlocklist = createMemo(() => can(session(), 'subscriber', 'blocklist'));
	const [searchParams] = useSearchParams();
	const [selectedIds, setSelectedIds] = createSignal<number[]>([]);
	const [dialog, setDialog] = createSignal<'delete' | 'blocklist' | null>(null);
	const [mutationPending, setMutationPending] = createSignal(false);
	const [mutationError, setMutationError] = createSignal('');
	const selected = createMemo(() => props.page.items.filter((subscriber) => selectedIds().includes(subscriber.id)));
	const blocklistSelection = createMemo(() => selected().filter((subscriber) => subscriber.status !== 'blocklisted'));
	const selectableIds = createMemo(() => props.page.items
		.filter((subscriber) => canDelete() || (canBlocklist() && subscriber.status !== 'blocklisted'))
		.slice(0, MAX_BULK_SUBSCRIBER_SELECTION)
		.map(({ id }) => id));
	const allSelected = createMemo(() => selectableIds().length > 0 && selectableIds().every((id) => selectedIds().includes(id)));
	const someSelected = createMemo(() => selected().length > 0 && !allSelected());
	const totalPages = createMemo(() => Math.max(1, Math.ceil(props.page.total / props.page.pageSize)));

	createEffect(
		() => `${props.page.page}:${props.page.search}`,
		(key, previous) => {
			if (previous !== undefined && key !== previous) setSelectedIds([]);
		},
	);
	createEffect(
		() => ({ requested: decodeSubscriberListLocation(searchParams), resolvedPage: props.page.page, resolvedSearch: props.page.search }),
		({ requested, resolvedPage, resolvedSearch }) => {
			// Canonicalize only after the response belongs to the current search.
			if (requested.search === resolvedSearch && requested.page !== resolvedPage) {
				navigate(subscriberListHref({ page: resolvedPage, search: resolvedSearch }), { replace: true });
			}
		},
	);

	function toggleSubscriber(id: number, checked: boolean): void {
		setSelectedIds((current) => {
			if (!checked) return current.filter((selectedId) => selectedId !== id);
			if (current.includes(id) || current.length >= MAX_BULK_SUBSCRIBER_SELECTION) return current;
			return [...current, id];
		});
	}

	async function mutateSelection(): Promise<void> {
		const operation = dialog();
		if (!operation) return;
		setMutationPending(true);
		setMutationError('');
		try {
			const subscribers = (operation === 'blocklist' ? blocklistSelection() : selected()).map((subscriber) => ({
				id: subscriber.id,
				expectedUpdatedAt: subscriber.updatedAt,
			}));
			if (operation === 'blocklist') await blocklistSubscribers({ subscribers });
			else await deleteSubscribers({ subscribers });
			setDialog(null);
			setSelectedIds([]);
			revalidate(listSubscribers.key);
			toast.success(operation === 'blocklist' ? 'Subscribers blocklisted.' : 'Subscribers deleted.');
		} catch (caught) {
			setMutationError(visibleError(caught, `The selected subscribers could not be ${operation === 'blocklist' ? 'blocklisted' : 'deleted'}.`));
		} finally {
			setMutationPending(false);
		}
	}

	return (
		<>
			<Show when={selected().length > 0}>
				<div class="bulk-actions subscriber-selection" role="status">
					<span>{selected().length} subscriber{selected().length === 1 ? '' : 's'} selected on this page</span>
					<Show when={canBlocklist() && blocklistSelection().length > 0}><button class="button button--danger-secondary" type="button" onClick={() => { setMutationError(''); setDialog('blocklist'); }}>Blocklist {blocklistSelection().length}</button></Show>
					<Show when={canDelete()}><button class="button button--danger-secondary" type="button" onClick={() => { setMutationError(''); setDialog('delete'); }}>Delete selected</button></Show>
					<button class="button button--secondary" type="button" onClick={() => setSelectedIds([])}>Clear</button>
				</div>
			</Show>
			<div class="data-table-scroll">
				<table class="data-table">
					<caption class="visually-hidden">Subscribers in fixed provider order</caption>
					<thead><tr><th scope="col"><SelectionCheckbox label="Select all actionable subscribers on this page" checked={allSelected()} indeterminate={someSelected()} disabled={selectableIds().length === 0} onChange={(event) => setSelectedIds(event.currentTarget.checked ? selectableIds() : [])} /></th><th scope="col">Subscriber</th><th scope="col">Status</th><th scope="col">Updated</th></tr></thead>
					<tbody>
						<Show when={props.page.items.length > 0} fallback={<tr><td colspan="4">No subscribers match this search.</td></tr>}>
							<For each={props.page.items}>{(subscriber) => <tr><td><SelectionCheckbox label={`Select ${subscriber.email}`} checked={selectedIds().includes(subscriber.id)} disabled={!canDelete() && (!canBlocklist() || subscriber.status === 'blocklisted')} onChange={(event) => toggleSubscriber(subscriber.id, event.currentTarget.checked)} /></td><td><div class="subscriber-name-cell"><a href={subscriberHref(subscriber.id)}>{subscriber.email}</a><small>{subscriber.name || 'No name'}</small></div></td><td><span class={statusClass(subscriber.status)}>{subscriber.status}</span></td><td>{new Date(subscriber.updatedAt).toLocaleString()}</td></tr>}</For>
						</Show>
					</tbody>
				</table>
			</div>
			<nav class="pagination" aria-label="Subscriber pages">
				<span>Page {props.page.page.toLocaleString()} of {totalPages().toLocaleString()} · {props.page.total.toLocaleString()} total</span>
				<div><Show when={props.page.page > 1}><a class="button button--secondary" rel="prev" href={subscriberListHref({ page: props.page.page - 1, search: props.page.search })}>Previous</a></Show><Show when={props.page.page < totalPages()}><a class="button button--secondary" rel="next" href={subscriberListHref({ page: props.page.page + 1, search: props.page.search })}>Next</a></Show></div>
			</nav>
			<ConfirmDialog open={dialog() === 'blocklist'} title="Blocklist selected subscribers?" description={`Blocklist ${blocklistSelection().length} subscriber${blocklistSelection().length === 1 ? '' : 's'}? Listmonk will unsubscribe all of their memberships. Restoring them requires a separate recovery workflow.`} confirmLabel="Blocklist subscribers" pending={mutationPending()} error={mutationError()} onConfirm={() => void mutateSelection()} onOpenChange={(open) => { if (!open) setDialog(null); }} />
			<ConfirmDialog open={dialog() === 'delete'} title="Delete selected subscribers?" description={`Permanently delete ${selected().length} subscriber${selected().length === 1 ? '' : 's'} and their Listmonk history? This cannot be undone.`} confirmLabel="Delete subscribers" pending={mutationPending()} error={mutationError()} onConfirm={() => void mutateSelection()} onOpenChange={(open) => { if (!open) setDialog(null); }} />
		</>
	);
}
