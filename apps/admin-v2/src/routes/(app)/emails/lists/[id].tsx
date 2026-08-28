import { can } from '@yah/admin-core/permissions';
import { revalidate, useNavigate, type RouteProps } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo, createSignal } from 'solid-js';
import type { MailingList } from '~/features/mailing-lists/contracts';
import { MailingListForm, mailingListKindLabel, mailingListStatusLabel, type MailingListFormValues } from '~/features/mailing-lists/form';
import { decodeMailingListRouteId } from '~/features/mailing-lists/routing';
import { deleteMailingList, getMailingList, listMailingLists, updateMailingList } from '~/features/mailing-lists/server';
import { requireSession } from '~/platform/auth/session';
import { Breadcrumbs } from '~/ui/breadcrumbs';
import { PageHeader } from '~/ui/page-header';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/emails/lists/:id', {
	matchFilters: { id: (segment) => decodeMailingListRouteId(segment) > 0 },
	preload: ({ params }) => void getMailingList(decodeMailingListRouteId(params.id)),
});

export default function MailingListDetailPage(props: RouteProps<typeof route>) {
	const listId = createMemo(() => decodeMailingListRouteId(props.params.id));
	return <Show when={listId()} keyed>{(resolved) => <MailingListRoute listId={resolved} />}</Show>;
}

function MailingListRoute(props: { listId: number }) {
	const list = createMemo(() => getMailingList(props.listId));
	return <Show when={list()}>{(resolved) => <MailingListDetail list={resolved()} />}</Show>;
}

function MailingListDetail(props: { list: MailingList }) {
	const navigate = useNavigate();
	const session = createMemo(() => requireSession());
	const canEdit = createMemo(() => can(session(), 'list', 'edit') && props.list.kind !== 'temporary');
	const canDelete = createMemo(() => can(session(), 'list', 'delete') && props.list.kind !== 'temporary');
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');
	const [deleteOpen, setDeleteOpen] = createSignal(false);
	const [deletePending, setDeletePending] = createSignal(false);
	const [deleteError, setDeleteError] = createSignal('');

	async function submit(values: MailingListFormValues): Promise<void> {
		setError('');
		setPending(true);
		try {
			await updateMailingList({ id: props.list.id, expectedUpdatedAt: props.list.updatedAt, ...values });
			revalidate([getMailingList.keyFor(props.list.id), listMailingLists.key]);
			try {
				await getMailingList(props.list.id);
			} catch {
				setError('The mailing list was saved, but its latest provider state could not be reloaded. Reload this page before editing again.');
				return;
			}
			toast.success('Mailing list updated.');
		} catch (caught) {
			setError(visibleError(caught, 'The mailing list could not be updated.'));
		} finally {
			setPending(false);
		}
	}

	async function remove(): Promise<void> {
		setDeletePending(true);
		setDeleteError('');
		try {
			await deleteMailingList(props.list.id);
			revalidate(listMailingLists.key);
			setDeleteOpen(false);
			toast.success('Mailing list deleted.');
			navigate('/emails/lists');
		} catch (caught) {
			setDeleteError(visibleError(caught, 'The mailing list could not be deleted.'));
		} finally {
			setDeletePending(false);
		}
	}

	return (
		<section class="mailing-lists-page">
			<Breadcrumbs items={[{ href: '/emails/lists', label: 'Mailing lists' }, { label: props.list.name }]} />
			<PageHeader title={props.list.name} description={`${mailingListKindLabel(props.list.kind)} · ${mailingListStatusLabel(props.list.status)} · ${props.list.optIn === 'double' ? 'Double' : 'Single'} opt-in`}>
				<Show when={canDelete()}><button class="button button--danger-secondary" type="button" onClick={() => setDeleteOpen(true)}>Delete</button></Show>
			</PageHeader>
			<Show when={canEdit()} fallback={<ReadOnlyMailingList list={props.list} />}>
				<MailingListForm
					mode="edit"
					initial={{ name: props.list.name, kind: props.list.kind === 'public' ? 'public' : 'private', optIn: props.list.optIn, status: props.list.status, description: props.list.description }}
					pending={pending()}
					error={error()}
					cancelHref="/emails/lists"
					onSubmit={(values) => void submit(values)}
				/>
			</Show>
			<ConfirmDialog
				open={deleteOpen()}
				title="Delete mailing list?"
				description={`Permanently delete ${props.list.name}? Its subscriptions will be removed, but subscriber identities remain in Listmonk.`}
				confirmLabel="Delete list"
				pending={deletePending()}
				error={deleteError()}
				onConfirm={() => void remove()}
				onOpenChange={setDeleteOpen}
			/>
		</section>
	);
}

function ReadOnlyMailingList(props: { list: MailingList }) {
	return (
		<>
			<Show when={props.list.kind === 'temporary'}><p class="mailing-list-note">Temporary lists are provider-managed and read-only here.</p></Show>
			<dl class="mailing-list-metadata metadata-list">
				<div><dt>Visibility</dt><dd>{mailingListKindLabel(props.list.kind)}</dd></div>
				<div><dt>Status</dt><dd>{mailingListStatusLabel(props.list.status)}</dd></div>
				<div><dt>Opt-in</dt><dd>{props.list.optIn === 'double' ? 'Double' : 'Single'}</dd></div>
				<div><dt>Subscribers</dt><dd>{props.list.subscriberCount}</dd></div>
				<div><dt>Unconfirmed</dt><dd>{props.list.unconfirmedCount}</dd></div>
				<div><dt>Description</dt><dd>{props.list.description || 'None'}</dd></div>
				<div><dt>Tags</dt><dd>{props.list.tags.join(', ') || 'None'}</dd></div>
				<div><dt>Updated</dt><dd>{new Date(props.list.updatedAt).toLocaleString()}</dd></div>
			</dl>
		</>
	);
}
