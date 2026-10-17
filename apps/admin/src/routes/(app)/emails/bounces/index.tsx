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
import { createCommandTask } from '~/ui/command-task';
import { PageHeader } from '~/ui/page-header';
import { Pagination } from '~/ui/pagination';
import { createRowSelection } from '~/ui/row-selection';
import { SelectionCheckbox } from '~/ui/selection-checkbox';
import { toast } from '~/ui/toast';

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
	const clearAllTask = createCommandTask();

	async function clearAllRecords(): Promise<void> {
		await clearAllTask.run(async () => {
			await clearAllBounces();
			setClearAllOpen(false);
			navigate('/emails/bounces', { replace: true });
			revalidate(listBounces.key);
			toast.success('All bounce records cleared.');
		}, 'The bounce history could not be cleared.');
	}

	return (
		<section class="bounces-page">
			<PageHeader eyebrow="Email delivery" title="Bounces">
				<Show when={canClearAll()}><button class="button button--danger-secondary" type="button" onClick={() => { clearAllTask.clearError(); setClearAllOpen(true); }}>Clear all bounce records</button></Show>
			</PageHeader>
			<p class="bounce-order-note">Live newest-first provider pages may shift while records arrive or are cleared. Clearing history does not restore blocklisted subscribers or mailing-list memberships.</p>
			<Loading on={requestIdentity()} fallback={<p class="table-loading" role="status">Loading bounces…</p>}>
				<Show when={page()}>{(resolved) => <BounceResults page={resolved()} />}</Show>
			</Loading>
			<ConfirmDialog open={clearAllOpen()} title="Clear all bounce records?" description="Permanently clear the complete bounce history? This does not restore subscriber or membership state and cannot be undone." confirmLabel="Clear all bounce records" pending={clearAllTask.pending()} error={clearAllTask.error()} onConfirm={() => void clearAllRecords()} onOpenChange={setClearAllOpen} />
		</section>
	);
}

function BounceResults(props: { page: BouncePage }) {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const session = createMemo(() => requireSession());
	const canDelete = createMemo(() => can(session(), 'bounce', 'delete'));
	const [dialogOpen, setDialogOpen] = createSignal(false);
	const deleteTask = createCommandTask();
	const selectable = createMemo(() => canDelete() ? props.page.items : []);
	const selection = createRowSelection(selectable, { scope: () => props.page.requestedPage });

	createEffect(
		() => ({ requested: decodeBounceListLocation(searchParams).page, page: props.page.page, responseFor: props.page.requestedPage }),
		({ requested, page, responseFor }) => {
			if (requested === responseFor && requested !== page) {
				navigate(bounceListHref({ page }), { replace: true });
			}
		},
	);

	function openDialog(): void {
		deleteTask.clearError();
		setDialogOpen(true);
	}

	async function clearRecords(): Promise<void> {
		const ids = selection.selected().map(({ id }) => id);
		const selectedCount = ids.length;
		await deleteTask.run(async () => {
			await deleteBounces({ ids });
			setDialogOpen(false);
			selection.clear();
			navigate('/emails/bounces', { replace: true });
			revalidate(listBounces.key);
			toast.success(`${selectedCount} bounce record${selectedCount === 1 ? '' : 's'} cleared.`);
		}, 'The selected bounce records could not be cleared.');
	}

	return (
		<>
			<Show when={selection.selected().length > 0}>
				<div class="bulk-actions bounce-selection" role="status">
					<span>{selection.selected().length} bounce record{selection.selected().length === 1 ? '' : 's'} selected on this page</span>
					<button class="button button--danger-secondary" type="button" onClick={openDialog}>Clear selected</button>
					<button class="button button--secondary" type="button" onClick={selection.clear}>Cancel selection</button>
				</div>
			</Show>
			<div class="data-table-scroll">
				<table class="data-table">
					<caption class="visually-hidden">Bounce records in newest-first provider order</caption>
					<thead><tr><th scope="col"><SelectionCheckbox label="Select every bounce record on this page" checked={selection.all()} indeterminate={selection.some()} disabled={!canDelete() || props.page.items.length === 0} onChange={(event) => selection.setAll(event.currentTarget.checked)} /></th><th scope="col">Subscriber</th><th scope="col">Campaign</th><th scope="col">Type</th><th scope="col">Source</th><th scope="col">Date</th></tr></thead>
					<tbody>
						<Show when={props.page.items.length > 0} fallback={<tr><td colspan="6">No bounce records are available.</td></tr>}>
							<For each={props.page.items}>{(bounce) => <tr><td><SelectionCheckbox label={`Select bounce record for ${bounce.email}`} checked={selection.has(bounce.id)} disabled={!canDelete()} onChange={(event) => selection.toggle(bounce.id, event.currentTarget.checked)} /></td><td><strong class="bounce-subscriber-cell">{bounce.email}</strong></td><td>{bounce.campaignName ?? '—'}</td><td><span class={`badge bounce-type bounce-type--${bounce.type}`}>{bounceTypeLabel(bounce.type)}</span></td><td>{bounce.source || '—'}</td><td>{new Date(bounce.createdAt).toLocaleString()}</td></tr>}</For>
						</Show>
					</tbody>
				</table>
			</div>
			<Pagination label="Bounce pages" page={props.page.page} pageSize={BOUNCE_PAGE_SIZE} total={props.page.total} href={(page) => bounceListHref({ page })} />
			<ConfirmDialog open={dialogOpen()} title="Clear selected bounce records?" description={`Permanently clear ${selection.selected().length} bounce record${selection.selected().length === 1 ? '' : 's'}? This removes history only and cannot be undone.`} confirmLabel="Clear bounce records" pending={deleteTask.pending()} error={deleteTask.error()} onConfirm={() => void clearRecords()} onOpenChange={setDialogOpen} />
		</>
	);
}
