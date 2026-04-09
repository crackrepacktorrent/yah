import { createAsync, revalidate, type RouteDefinition } from '@solidjs/router';
import { Show, batch, createMemo, createSignal } from 'solid-js';
import { createSolidTable, getCoreRowModel, getFilteredRowModel, getFacetedRowModel, getFacetedUniqueValues, getSortedRowModel, createColumnHelper, type SortingState, type ColumnFiltersState } from '@tanstack/solid-table';
import { toast } from 'solid-sonner';
import {
	Badge, Button, Input, AlertDialog, Dialog, DataTable, PageHeader,
	FormField, Select,
	createSelectColumn, multiSelectFilter, type RowSelectionState,
} from '~/components';
import { requireSession } from '~/routes/session';
import { can } from '~/lib/can';
import { toastError } from '~/lib/utils';
import { listLists, createList, updateList, deleteLists, sendOptinCampaign } from '../lists.server';
import './index.css';

export const route: RouteDefinition = {
	preload: () => { void listLists(); },
};

type ListItem = {
	id: number;
	name: string;
	type: 'public' | 'private';
	optin: 'single' | 'double';
	description: string;
	subscriber_count: number;
	subscriber_statuses: Record<string, number>;
	created_at: string;
	updated_at: string;
};

const columnHelper = createColumnHelper<ListItem>();

export default function ListsPage() {
	const session = createAsync(() => requireSession());
	const data = createAsync(() => listLists());

	// ─── Table state ────────────────────────────────────────────────────────────

	const [globalFilter, setGlobalFilter] = createSignal('');
	const [columnFilters, setColumnFilters] = createSignal<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
	const [sorting, setSorting] = createSignal<SortingState>([]);

	// ─── Create dialog ────────────────────────────────────────────────────────────

	const [createOpen, setCreateOpen] = createSignal(false);
	const [createPending, setCreatePending] = createSignal(false);
	const [createName, setCreateName] = createSignal('');
	const [createType, setCreateType] = createSignal<'public' | 'private'>('public');
	const [createOptin, setCreateOptin] = createSignal<'single' | 'double'>('single');
	const [createDescription, setCreateDescription] = createSignal('');

	// ─── Edit dialog ──────────────────────────────────────────────────────────────

	const [editOpen, setEditOpen] = createSignal(false);
	const [editPending, setEditPending] = createSignal(false);
	const [editId, setEditId] = createSignal(0);
	const [editName, setEditName] = createSignal('');
	const [editType, setEditType] = createSignal<'public' | 'private'>('public');
	const [editOptin, setEditOptin] = createSignal<'single' | 'double'>('single');
	const [editDescription, setEditDescription] = createSignal('');

	// ─── Confirm dialogs ─────────────────────────────────────────────────────────

	const [confirmDelete, setConfirmDelete] = createSignal(false);
	const [confirmOptin, setConfirmOptin] = createSignal<{ open: boolean; listId: number; listName: string }>({
		open: false, listId: 0, listName: '',
	});

	// ─── Columns ─────────────────────────────────────────────────────────────────

	const columns = [
		createSelectColumn<ListItem>(),
		columnHelper.accessor('name', {
			header: 'Name',
			enableColumnFilter: false,
			cell: (info) => (
				<button class="cell-link" onClick={() => openEdit(info.row.original)}>{info.getValue()}</button>
			),
		}),
		columnHelper.accessor('type', {
			header: 'Type',
			filterFn: multiSelectFilter,
			cell: (info) => <Badge variant={info.getValue() === 'public' ? 'info' : 'default'}>{info.getValue()}</Badge>,
		}),
		columnHelper.accessor('optin', {
			header: 'Opt-in',
			filterFn: multiSelectFilter,
			cell: (info) => <Badge variant={info.getValue() === 'double' ? 'warning' : 'success'}>{info.getValue()}</Badge>,
		}),
		columnHelper.accessor('subscriber_count', {
			header: 'Subscribers',
			enableColumnFilter: false,
			cell: (info) => {
				const list = info.row.original;
				const unconfirmed = list.subscriber_statuses?.['unconfirmed'] ?? 0;
				return (
					<>
						<span class="count">{list.subscriber_count}</span>
						<Show when={unconfirmed > 0}>
							<span class="unconfirmed">
								{unconfirmed} unconfirmed
								<Show when={list.optin === 'double' && can(session(), 'list', 'edit')}>
									<button
										class="optin-btn"
										onClick={() => setConfirmOptin({ open: true, listId: list.id, listName: list.name })}
									>
										Send opt-in
									</button>
								</Show>
							</span>
						</Show>
					</>
				);
			},
		}),
		columnHelper.accessor('created_at', {
			header: 'Created',
			enableColumnFilter: false,
			cell: (info) => <span class="cell-date">{new Date(info.getValue()).toLocaleDateString()}</span>,
		}),
		columnHelper.accessor('updated_at', {
			header: 'Updated',
			enableColumnFilter: false,
			cell: (info) => <span class="cell-date">{new Date(info.getValue()).toLocaleDateString()}</span>,
		}),
	];

	const table = createSolidTable({
		get data() { return data()?.lists ?? []; },
		columns,
		state: {
			get globalFilter() { return globalFilter(); },
			get columnFilters() { return columnFilters(); },
			get rowSelection() { return rowSelection(); },
			get sorting() { return sorting(); },
		},
		onGlobalFilterChange: setGlobalFilter,
		onColumnFiltersChange: setColumnFilters,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		enableRowSelection: () => can(session(), 'list', 'delete'),
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
		getSortedRowModel: getSortedRowModel(),
	});

	const selectedRows = createMemo(() => table.getSelectedRowModel().rows.map((r) => r.original));

	// ─── Handlers ─────────────────────────────────────────────────────────────────

	function openCreate() {
		batch(() => {
			setCreateName('');
			setCreateType('public');
			setCreateOptin('single');
			setCreateDescription('');
			setCreateOpen(true);
		});
	}

	function openEdit(list: ListItem) {
		batch(() => {
			setEditId(list.id);
			setEditName(list.name);
			setEditType(list.type);
			setEditOptin(list.optin);
			setEditDescription(list.description);
			setEditOpen(true);
		});
	}

	async function handleCreate() {
		setCreatePending(true);
		try {
			await createList({
				name: createName(),
				type: createType(),
				optin: createOptin(),
				description: createDescription() || undefined,
			});
			setCreateOpen(false);
			toast.success('List created.');
			await revalidate('listLists');
		} catch (err) {
			toastError(err, 'Failed to create list.');
		} finally {
			setCreatePending(false);
		}
	}

	async function handleEdit() {
		setEditPending(true);
		try {
			await updateList({
				id: editId(),
				name: editName(),
				type: editType(),
				optin: editOptin(),
				description: editDescription(),
			});
			setEditOpen(false);
			toast.success('List updated.');
			setRowSelection({});
			await revalidate('listLists');
		} catch (err) {
			toastError(err, 'Failed to update list.');
		} finally {
			setEditPending(false);
		}
	}

	async function handleDelete() {
		try {
			await deleteLists(selectedRows().map((l) => l.id));
			toast.success(`${selectedRows().length} list${selectedRows().length > 1 ? 's' : ''} deleted.`);
			setRowSelection({});
			await revalidate('listLists');
		} catch (err) {
			toastError(err, 'Failed to delete lists.');
		}
	}

	async function handleSendOptin() {
		try {
			const result = await sendOptinCampaign(confirmOptin().listId);
			toast.success(`Opt-in confirmations sent to ${result.sent} of ${result.total} subscribers.`);
			setConfirmOptin({ open: false, listId: 0, listName: '' });
		} catch (err) {
			toastError(err, 'Failed to send opt-in campaign.');
		}
	}

	// ─── Toolbar ──────────────────────────────────────────────────────────────────

	const toolbar = () => (
		<Show
			when={selectedRows().length > 0 && can(session(), 'list', 'delete')}
			fallback={
				<div class="dt-toolbar-search">
					<input
						class="admin-input"
						type="text"
						placeholder="Filter lists…"
						value={globalFilter()}
						onInput={(e) => setGlobalFilter(e.currentTarget.value)}
					/>
					<Show when={can(session(), 'list', 'create')}>
						<Button onClick={openCreate}>+ New List</Button>
					</Show>
				</div>
			}
		>
			<span class="dt-selection-count">{selectedRows().length} selected</span>
			<Button variant="danger-outline" onClick={() => setConfirmDelete(true)}>Delete</Button>
			<button class="dt-clear-btn" onClick={() => setRowSelection({})}>Clear</button>
		</Show>
	);

	return (
		<>
			<PageHeader title="Mailing Lists" />

			<DataTable table={table} toolbar={toolbar} emptyMessage="No mailing lists found." />

			<AlertDialog
				open={confirmDelete()}
				onOpenChange={setConfirmDelete}
				title={`Delete List${selectedRows().length > 1 ? 's' : ''}`}
				description={`Permanently delete ${selectedRows().length} list${selectedRows().length > 1 ? 's' : ''}? Subscribers will not be deleted.`}
				confirmLabel="Yes, delete"
				onconfirm={handleDelete}
			/>

			<AlertDialog
				open={confirmOptin().open}
				onOpenChange={(open) => setConfirmOptin((prev) => ({ ...prev, open }))}
				title="Send Opt-in Campaign"
				description={`Send opt-in confirmation emails to all unconfirmed subscribers on "${confirmOptin().listName}"?`}
				confirmLabel="Yes, send"
				variant="primary"
				onconfirm={handleSendOptin}
			/>

			{/* Create dialog */}
			<Dialog
				open={createOpen()}
				onOpenChange={setCreateOpen}
				title="New List"
				footer={<>
					<Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
					<Button onClick={handleCreate} disabled={createPending() || !createName().trim()}>
						{createPending() ? 'Creating…' : 'Create'}
					</Button>
				</>}
			>
				<div class="form-fields">
					<FormField label="Name" required>
						<Input
							placeholder="Newsletter"
							value={createName()}
							onInput={(e) => setCreateName(e.currentTarget.value)}
						/>
					</FormField>

					<div class="form-row">
						<FormField label="Type" hint="Public lists are open to the world to subscribe and may appear on public pages.">
							<Select
								value={createType()}
								onValueChange={(v) => setCreateType(v as 'public' | 'private')}
								options={[{ value: 'public', label: 'Public' }, { value: 'private', label: 'Private' }]}
							/>
						</FormField>
						<FormField label="Opt-in" hint="Double opt-in sends a confirmation email. Campaigns are only sent to confirmed subscribers.">
							<Select
								value={createOptin()}
								onValueChange={(v) => setCreateOptin(v as 'single' | 'double')}
								options={[{ value: 'single', label: 'Single' }, { value: 'double', label: 'Double' }]}
							/>
						</FormField>
					</div>

					<FormField label="Description">
						<textarea
							class="textarea"
							rows="3"
							placeholder="Optional description…"
							value={createDescription()}
							onInput={(e) => setCreateDescription(e.currentTarget.value)}
						/>
					</FormField>
				</div>
			</Dialog>

			{/* Edit dialog */}
			<Dialog
				open={editOpen()}
				onOpenChange={setEditOpen}
				title="Edit List"
				footer={<>
					<Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
					<Button onClick={handleEdit} disabled={editPending() || !editName().trim()}>
						{editPending() ? 'Saving…' : 'Save'}
					</Button>
				</>}
			>
				<div class="form-fields">
					<FormField label="Name" required>
						<Input
							value={editName()}
							onInput={(e) => setEditName(e.currentTarget.value)}
						/>
					</FormField>

					<div class="form-row">
						<FormField label="Type" hint="Public lists are open to the world to subscribe and may appear on public pages.">
							<Select
								value={editType()}
								onValueChange={(v) => setEditType(v as 'public' | 'private')}
								options={[{ value: 'public', label: 'Public' }, { value: 'private', label: 'Private' }]}
							/>
						</FormField>
						<FormField label="Opt-in" hint="Double opt-in sends a confirmation email. Campaigns are only sent to confirmed subscribers.">
							<Select
								value={editOptin()}
								onValueChange={(v) => setEditOptin(v as 'single' | 'double')}
								options={[{ value: 'single', label: 'Single' }, { value: 'double', label: 'Double' }]}
							/>
						</FormField>
					</div>

					<FormField label="Description">
						<textarea
							class="textarea"
							rows="3"
							value={editDescription()}
							onInput={(e) => setEditDescription(e.currentTarget.value)}
						/>
					</FormField>
				</div>
			</Dialog>
		</>
	);
}
