import { createAsync, revalidate, type RouteDefinition } from '@solidjs/router';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { createSolidTable, getCoreRowModel, getFilteredRowModel, getFacetedRowModel, getFacetedUniqueValues, getSortedRowModel, createColumnHelper, type SortingState, type ColumnFiltersState } from '@tanstack/solid-table';
import { toast } from 'solid-sonner';
import {
	Badge, Button, AlertDialog, DataTable, PageHeader,
	createSelectColumn, multiSelectFilter, type RowSelectionState,
} from '~/components';
import { requireSession } from '~/routes/session';
import { can } from '~/lib/can';
import { subscriberStatusVariant, toastError } from '~/lib/utils';
import { listSubscribers, deleteSubscribers, blocklistSubscribers } from '../subscribers.server';
import { listLists } from '../lists.server';
import { SubscriberEditor } from './SubscriberEditor';
import './index.css';

export const route: RouteDefinition = {
	preload: () => {
		void listSubscribers();
		void listLists();
	},
};

type SubscriberList = {
	id: number;
	name: string;
	subscription_status: string;
};

type ListmonkSubscriber = {
	id: number;
	email: string;
	name: string;
	status: string;
	lists: SubscriberList[];
	created_at: string;
	updated_at: string;
};

const columnHelper = createColumnHelper<ListmonkSubscriber>();

export default function SubscribersPage() {
	const session = createAsync(() => requireSession());
	const data = createAsync(() => listSubscribers());
	const listsData = createAsync(() => listLists());

	// ─── State ───────────────────────────────────────────────────────────────────

	const [globalFilter, setGlobalFilter] = createSignal('');
	const [columnFilters, setColumnFilters] = createSignal<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
	const [sorting, setSorting] = createSignal<SortingState>([]);

	const [editorOpen, setEditorOpen] = createSignal(false);
	const [editorSubscriber, setEditorSubscriber] = createSignal<ListmonkSubscriber | null>(null);

	const [confirmDelete, setConfirmDelete] = createSignal(false);
	const [confirmBlocklist, setConfirmBlocklist] = createSignal(false);

	// ─── Handlers ─────────────────────────────────────────────────────────────────

	function openCreate() {
		setEditorSubscriber(null);
		setEditorOpen(true);
	}

	function openEdit(sub: ListmonkSubscriber) {
		setEditorSubscriber(sub);
		setEditorOpen(true);
	}

	async function handleEditorSaved() {
		setRowSelection({});
		await revalidate('listSubscribers');
	}

	async function handleDelete() {
		try {
			await deleteSubscribers(selectedRows().map((s) => s.id));
			toast.success(`${selectedRows().length} subscriber${selectedRows().length > 1 ? 's' : ''} deleted.`);
			setRowSelection({});
			await revalidate('listSubscribers');
		} catch (err) {
			toastError(err, 'Failed to delete subscribers.');
		}
	}

	async function handleBlocklist() {
		try {
			await blocklistSubscribers(selectedRows().map((s) => s.id));
			toast.success(`${selectedRows().length} subscriber${selectedRows().length > 1 ? 's' : ''} blocklisted.`);
			setRowSelection({});
			await revalidate('listSubscribers');
		} catch (err) {
			toastError(err, 'Failed to blocklist subscribers.');
		}
	}

	// ─── Columns ─────────────────────────────────────────────────────────────────

	const columns = [
		createSelectColumn<ListmonkSubscriber>(),
		columnHelper.accessor('email', {
			header: 'Email',
			enableColumnFilter: false,
			cell: (info) => (
				<button class="cell-link" onClick={() => openEdit(info.row.original)}>{info.getValue()}</button>
			),
		}),
		columnHelper.accessor('name', {
			header: 'Name',
			enableColumnFilter: false,
			cell: (info) => info.getValue() || '—',
		}),
		columnHelper.accessor('status', {
			header: 'Status',
			filterFn: multiSelectFilter,
			cell: (info) => <Badge variant={subscriberStatusVariant(info.getValue())}>{info.getValue()}</Badge>,
		}),
		columnHelper.accessor('lists', {
			header: 'Lists',
			enableSorting: false,
			enableColumnFilter: false,
			cell: (info) => {
				const lists = info.getValue();
				return lists.length === 0
					? <span class="cell-muted">—</span>
					: (
						<div class="cell-badges">
							<For each={lists}>
								{(list) => (
									<Badge variant={list.subscription_status === 'unconfirmed' ? 'warning' : 'default'}>
										{list.name}{list.subscription_status === 'unconfirmed' ? ' (unconfirmed)' : ''}
									</Badge>
								)}
							</For>
						</div>
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

	// ─── Table ───────────────────────────────────────────────────────────────────

	const table = createSolidTable({
		get data() { return (data()?.subscribers ?? []) as ListmonkSubscriber[]; },
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
		enableRowSelection: () => can(session(), 'subscriber', 'delete'),
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
		getSortedRowModel: getSortedRowModel(),
	});

	const selectedRows = createMemo(() => table.getSelectedRowModel().rows.map((r) => r.original));

	const canBlocklist = createMemo(() =>
		can(session(), 'subscriber', 'blocklist') &&
		selectedRows().some((s) => s.status !== 'blocklisted'),
	);

	// ─── Toolbar ──────────────────────────────────────────────────────────────────

	const toolbar = () => (
		<Show
			when={selectedRows().length > 0 && can(session(), 'subscriber', 'delete')}
			fallback={
				<div class="dt-toolbar-search">
					<input
						class="admin-input"
						type="text"
						placeholder="Filter by email or name…"
						value={globalFilter()}
						onInput={(e) => setGlobalFilter(e.currentTarget.value)}
					/>
					<Show when={can(session(), 'subscriber', 'create')}>
						<Button onClick={openCreate}>+ New Subscriber</Button>
					</Show>
				</div>
			}
		>
			<span class="dt-selection-count">{selectedRows().length} selected</span>
			<Show when={canBlocklist()}>
				<Button variant="danger-outline" onClick={() => setConfirmBlocklist(true)}>Blocklist</Button>
			</Show>
			<Button variant="danger-outline" onClick={() => setConfirmDelete(true)}>Delete</Button>
			<button class="dt-clear-btn" onClick={() => setRowSelection({})}>Clear</button>
		</Show>
	);

	return (
		<>
			<PageHeader title="Subscribers" />

			<DataTable table={table} toolbar={toolbar} emptyMessage="No subscribers found." />

			<AlertDialog
				open={confirmDelete()}
				onOpenChange={setConfirmDelete}
				title={`Delete Subscriber${selectedRows().length > 1 ? 's' : ''}`}
				description={`Permanently delete ${selectedRows().length} subscriber${selectedRows().length > 1 ? 's' : ''}? This cannot be undone.`}
				confirmLabel="Yes, delete"
				onconfirm={handleDelete}
			/>

			<AlertDialog
				open={confirmBlocklist()}
				onOpenChange={setConfirmBlocklist}
				title={`Blocklist Subscriber${selectedRows().length > 1 ? 's' : ''}`}
				description={`Blocklist ${selectedRows().length} subscriber${selectedRows().length > 1 ? 's' : ''}? They will no longer receive any emails.`}
				confirmLabel="Yes, blocklist"
				onconfirm={handleBlocklist}
			/>

			<SubscriberEditor
				open={editorOpen()}
				onOpenChange={setEditorOpen}
				subscriber={editorSubscriber()}
				allLists={listsData()?.lists ?? []}
				canEdit={can(session(), 'subscriber', 'edit')}
				onSaved={handleEditorSaved}
			/>
		</>
	);
}
