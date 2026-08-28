import { can } from '@yah/admin-core/permissions';
import { revalidate, useNavigate, useSearchParams } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { For, Loading, Show, createEffect, createMemo, createSignal } from 'solid-js';
import {
	BOUNCE_PAGE_SIZE,
	type BouncePage,
} from '~/features/bounces/contracts';
import { bounceTypeLabel } from '~/features/bounces/presentation';
import { bounceListHref, decodeBounceListLocation } from '~/features/bounces/routing';
import { clearAllBounces, deleteBounces, listBounces } from '~/features/bounces/server';
import { requireSession } from '~/platform/auth/session';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { PageHeader } from '~/ui/page-header';
import { SelectionCheckbox } from '~/ui/selection-checkbox';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/emails/bounces', {
	preload: ({ location }) => void listBounces(decodeBounceListLocation(location.query)),
});

export default function BounceListPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const request = createMemo(() => decodeBounceListLocation(searchParams));
	const page = createMemo(() => listBounces(request()));
	const requestIdentity = createMemo(() => bounceListHref(request()));
	const session = createMemo(() => requireSession());
	const canClearAll = createMemo(() => can(session(), 'bounce', 'clear-all'));
	const [clearAllOpen, setClearAllOpen] = createSignal(false);
	const [clearAllPending, setClearAllPending] = createSignal(false);
	const [clearAllError, setClearAllError] = createSignal('');

	async function clearAllRecords(): Promise<void> {
		setClearAllPending(true);
		setClearAllError('');
		try {
			await clearAllBounces();
			setClearAllOpen(false);
			navigate('/emails/bounces', { replace: true });
			revalidate(listBounces.key);
			toast.success('All bounce records cleared.');
		} catch (caught) {
			setClearAllError(visibleError(caught, 'The bounce history could not be cleared.'));
		} finally {
			setClearAllPending(false);
		}
	}

	return (
		<section class="bounces-page">
			<PageHeader eyebrow="Email delivery" title="Bounces">
				<Show when={canClearAll()}><button class="button button--danger-secondary" type="button" onClick={() => { setClearAllError(''); setClearAllOpen(true); }}>Clear all bounce records</button></Show>
			</PageHeader>
			<p class="bounce-order-note">Live newest-first provider pages may shift while records arrive or are cleared. Clearing history does not restore blocklisted subscribers or mailing-list memberships.</p>
			<Loading on={requestIdentity()} fallback={<p class="table-loading" role="status">Loading bounces…</p>}>
				<Show when={page()}>{(resolved) => <BounceResults page={resolved()} />}</Show>
			</Loading>
			<ConfirmDialog open={clearAllOpen()} title="Clear all bounce records?" description="Permanently clear the complete bounce history? This does not restore subscriber or membership state and cannot be undone." confirmLabel="Clear all bounce records" pending={clearAllPending()} error={clearAllError()} onConfirm={() => void clearAllRecords()} onOpenChange={setClearAllOpen} />
		</section>
	);
}

function BounceResults(props: { page: BouncePage }) {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const session = createMemo(() => requireSession());
	const canDelete = createMemo(() => can(session(), 'bounce', 'delete'));
	const [selectedIds, setSelectedIds] = createSignal<number[]>([]);
	const [dialogOpen, setDialogOpen] = createSignal(false);
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

	function openDialog(): void {
		setError('');
		setDialogOpen(true);
	}

	async function clearRecords(): Promise<void> {
		const selectedCount = selected().length;
		setPending(true);
		setError('');
		try {
			await deleteBounces({ ids: selected().map(({ id }) => id) });
			setDialogOpen(false);
			setSelectedIds([]);
			navigate('/emails/bounces', { replace: true });
			revalidate(listBounces.key);
			toast.success(`${selectedCount} bounce record${selectedCount === 1 ? '' : 's'} cleared.`);
		} catch (caught) {
			setError(visibleError(caught, 'The selected bounce records could not be cleared.'));
		} finally {
			setPending(false);
		}
	}

	return (
		<>
			<Show when={selected().length > 0}>
				<div class="bulk-actions bounce-selection" role="status">
					<span>{selected().length} bounce record{selected().length === 1 ? '' : 's'} selected on this page</span>
					<button class="button button--danger-secondary" type="button" onClick={openDialog}>Clear selected</button>
					<button class="button button--secondary" type="button" onClick={() => setSelectedIds([])}>Cancel selection</button>
				</div>
			</Show>
			<div class="data-table-scroll">
				<table class="data-table">
					<caption class="visually-hidden">Bounce records in newest-first provider order</caption>
					<thead><tr><th scope="col"><SelectionCheckbox label="Select every bounce record on this page" checked={allSelected()} indeterminate={someSelected()} disabled={!canDelete() || props.page.items.length === 0} onChange={(event) => setSelectedIds(event.currentTarget.checked ? selectableIds() : [])} /></th><th scope="col">Subscriber</th><th scope="col">Campaign</th><th scope="col">Type</th><th scope="col">Source</th><th scope="col">Date</th></tr></thead>
					<tbody>
						<Show when={props.page.items.length > 0} fallback={<tr><td colspan="6">No bounce records are available.</td></tr>}>
							<For each={props.page.items}>{(bounce) => <tr><td><SelectionCheckbox label={`Select bounce record for ${bounce.email}`} checked={selectedIds().includes(bounce.id)} disabled={!canDelete()} onChange={(event) => toggleBounce(bounce.id, event.currentTarget.checked)} /></td><td><strong class="bounce-subscriber-cell">{bounce.email}</strong></td><td>{bounce.campaignName ?? '—'}</td><td><span class={`badge bounce-type bounce-type--${bounce.type}`}>{bounceTypeLabel(bounce.type)}</span></td><td>{bounce.source || '—'}</td><td>{new Date(bounce.createdAt).toLocaleString()}</td></tr>}</For>
						</Show>
					</tbody>
				</table>
			</div>
			<nav class="pagination" aria-label="Bounce pages">
				<span>Page {props.page.page.toLocaleString()} of {totalPages().toLocaleString()} · {props.page.total.toLocaleString()} total</span>
				<div><Show when={props.page.page > 1}><a class="button button--secondary" rel="prev" href={bounceListHref({ page: props.page.page - 1 })}>Previous</a></Show><Show when={props.page.page < totalPages()}><a class="button button--secondary" rel="next" href={bounceListHref({ page: props.page.page + 1 })}>Next</a></Show></div>
			</nav>
			<ConfirmDialog open={dialogOpen()} title="Clear selected bounce records?" description={`Permanently clear ${selected().length} bounce record${selected().length === 1 ? '' : 's'}? This removes history only and cannot be undone.`} confirmLabel="Clear bounce records" pending={pending()} error={error()} onConfirm={() => void clearRecords()} onOpenChange={setDialogOpen} />
		</>
	);
}
