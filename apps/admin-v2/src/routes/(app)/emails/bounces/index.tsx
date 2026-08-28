import { revalidate, useNavigate, useSearchParams } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import {
	BOUNCE_PAGE_SIZE,
	type BouncePage,
} from '~/features/bounces/contracts';
import { bounceTypeLabel } from '~/features/bounces/presentation';
import { bounceListHref, decodeBounceListLocation } from '~/features/bounces/routing';
import { clearAllBounces, deleteBounces, listBounces } from '~/features/bounces/server';
import { requireSession } from '~/platform/auth/session';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { SelectionCheckbox } from '~/ui/selection-checkbox';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/emails/bounces', {
	preload: ({ location }) => void listBounces(decodeBounceListLocation(location.query)),
});

export default function BounceListPage() {
	const [searchParams] = useSearchParams();
	const request = createMemo(() => decodeBounceListLocation(searchParams));
	const page = createMemo(() => listBounces(request()));
	return <Show when={page()}>{(resolved) => <BounceTable page={resolved()} />}</Show>;
}

function BounceTable(props: { page: BouncePage }) {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const session = createMemo(() => requireSession());
	const canDelete = createMemo(() => session().permissions['bounce']?.includes('delete') ?? false);
	const canClearAll = createMemo(() => session().permissions['bounce']?.includes('clear-all') ?? false);
	const [selectedIds, setSelectedIds] = createSignal<number[]>([]);
	const [dialog, setDialog] = createSignal<'selected' | 'all' | null>(null);
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');
	const selected = createMemo(() => props.page.items.filter(({ id }) => selectedIds().includes(id)));
	const selectableIds = createMemo(() => canDelete() ? props.page.items.map(({ id }) => id) : []);
	const allSelected = createMemo(() => selectableIds().length > 0 && selectableIds().every((id) => selectedIds().includes(id)));
	const someSelected = createMemo(() => selected().length > 0 && !allSelected());
	const totalPages = createMemo(() => Math.max(1, Math.ceil(props.page.total / BOUNCE_PAGE_SIZE)));

	createEffect(
		() => props.page.requestedPage,
		(requestedPage, previous) => {
			if (previous !== undefined && requestedPage !== previous) setSelectedIds([]);
		},
	);
	createEffect(
		() => ({ requested: decodeBounceListLocation(searchParams).page, page: props.page.page, responseFor: props.page.requestedPage }),
		({ requested, page, responseFor }) => {
			if (requested === responseFor && requested !== page) {
				navigate(bounceListHref({ page }), { replace: true });
			}
		},
	);

	function toggleBounce(id: number, checked: boolean): void {
		setSelectedIds((current) => checked
			? current.includes(id) ? current : [...current, id]
			: current.filter((selectedId) => selectedId !== id));
	}

	function openDialog(next: 'selected' | 'all'): void {
		setError('');
		setDialog(next);
	}

	async function clearRecords(): Promise<void> {
		const operation = dialog();
		if (!operation) return;
		const selectedCount = selected().length;
		setPending(true);
		setError('');
		try {
			if (operation === 'selected') await deleteBounces({ ids: selected().map(({ id }) => id) });
			else await clearAllBounces();
			setDialog(null);
			setSelectedIds([]);
			navigate('/emails/bounces', { replace: true });
			revalidate(listBounces.key);
			toast.success(operation === 'selected'
				? `${selectedCount} bounce record${selectedCount === 1 ? '' : 's'} cleared.`
				: 'All bounce records cleared.');
		} catch (caught) {
			setError(visibleError(caught, operation === 'selected'
				? 'The selected bounce records could not be cleared.'
				: 'The bounce history could not be cleared.'));
		} finally {
			setPending(false);
		}
	}

	return (
		<section class="bounces-page">
			<header class="page-header">
				<div><p class="eyebrow">Email delivery</p><h1>Bounces</h1></div>
				<Show when={canClearAll()}><button class="button button--danger-secondary" type="button" onClick={() => openDialog('all')}>Clear all bounce records</button></Show>
			</header>
			<p class="bounce-order-note">Live newest-first provider pages may shift while records arrive or are cleared. Clearing history does not restore blocklisted subscribers or mailing-list memberships.</p>
			<Show when={selected().length > 0}>
				<div class="bounce-selection" role="status">
					<span>{selected().length} bounce record{selected().length === 1 ? '' : 's'} selected on this page</span>
					<button class="button button--danger-secondary" type="button" onClick={() => openDialog('selected')}>Clear selected</button>
					<button class="button button--secondary" type="button" onClick={() => setSelectedIds([])}>Cancel selection</button>
				</div>
			</Show>
			<div class="data-table-scroll">
				<table class="data-table">
					<caption class="visually-hidden">Bounce records in newest-first provider order</caption>
					<thead><tr><th scope="col"><SelectionCheckbox label="Select every bounce record on this page" checked={allSelected()} indeterminate={someSelected()} disabled={!canDelete() || props.page.items.length === 0} onChange={(event) => setSelectedIds(event.currentTarget.checked ? selectableIds() : [])} /></th><th scope="col">Subscriber</th><th scope="col">Campaign</th><th scope="col">Type</th><th scope="col">Source</th><th scope="col">Date</th></tr></thead>
					<tbody>
						<Show when={props.page.items.length > 0} fallback={<tr><td colspan="6">No bounce records are available.</td></tr>}>
							<For each={props.page.items}>{(bounce) => <tr><td><SelectionCheckbox label={`Select bounce record for ${bounce.email}`} checked={selectedIds().includes(bounce.id)} disabled={!canDelete()} onChange={(event) => toggleBounce(bounce.id, event.currentTarget.checked)} /></td><td><strong class="bounce-subscriber-cell">{bounce.email}</strong></td><td>{bounce.campaignName ?? '—'}</td><td><span class={`bounce-type bounce-type--${bounce.type}`}>{bounceTypeLabel(bounce.type)}</span></td><td>{bounce.source || '—'}</td><td>{new Date(bounce.createdAt).toLocaleString()}</td></tr>}</For>
						</Show>
					</tbody>
				</table>
			</div>
			<nav class="bounce-pagination" aria-label="Bounce pages">
				<span>Page {props.page.page.toLocaleString()} of {totalPages().toLocaleString()} · {props.page.total.toLocaleString()} total</span>
				<div><Show when={props.page.page > 1}><a class="button button--secondary" rel="prev" href={bounceListHref({ page: props.page.page - 1 })}>Previous</a></Show><Show when={props.page.page < totalPages()}><a class="button button--secondary" rel="next" href={bounceListHref({ page: props.page.page + 1 })}>Next</a></Show></div>
			</nav>
			<ConfirmDialog open={dialog() === 'selected'} title="Clear selected bounce records?" description={`Permanently clear ${selected().length} bounce record${selected().length === 1 ? '' : 's'}? This removes history only and cannot be undone.`} confirmLabel="Clear bounce records" pending={pending()} error={error()} onConfirm={() => void clearRecords()} onOpenChange={(open) => { if (!open) setDialog(null); }} />
			<ConfirmDialog open={dialog() === 'all'} title="Clear all bounce records?" description="Permanently clear the complete bounce history? This does not restore subscriber or membership state and cannot be undone." confirmLabel="Clear all bounce records" pending={pending()} error={error()} onConfirm={() => void clearRecords()} onOpenChange={(open) => { if (!open) setDialog(null); }} />
		</section>
	);
}
