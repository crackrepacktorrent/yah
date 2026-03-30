import { createAsync, revalidate, type RouteDefinition } from '@solidjs/router';
import { Show, createMemo, createSignal } from 'solid-js';
import { createSolidTable, getCoreRowModel, getFilteredRowModel, createColumnHelper } from '@tanstack/solid-table';
import { toast } from 'solid-sonner';
import {
	Badge, Button, AlertDialog, DataTable, PageHeader,
	createSelectColumn, type RowSelectionState,
} from '~/components/admin';
import { requireSession } from '~/routes/admin/session';
import { can } from '~/lib/can';
import { toastError } from '~/lib/utils';
import { listBounces, deleteBounces, deleteAllBounces } from '../bounces.server';
import './index.css';

export const route: RouteDefinition = {
	preload: () => { void listBounces(); },
};

type Bounce = {
	id: number;
	email: string;
	campaign_id: number;
	type: string;
	source: string;
	created_at: string;
};

function bounceTypeVariant(type: string): 'error' | 'warning' | 'info' | 'default' {
	if (type === 'hard') return 'error';
	if (type === 'soft') return 'warning';
	if (type === 'complaint') return 'info';
	return 'default';
}

const columnHelper = createColumnHelper<Bounce>();

const columns = [
	createSelectColumn<Bounce>(),
	columnHelper.accessor('email', {
		header: 'Email',
		enableSorting: false,
		cell: (info) => info.getValue(),
	}),
	columnHelper.accessor('campaign_id', {
		header: 'Campaign',
		enableSorting: false,
		cell: (info) => info.getValue() || '—',
	}),
	columnHelper.accessor('type', {
		header: 'Type',
		enableSorting: false,
		cell: (info) => <Badge variant={bounceTypeVariant(info.getValue())}>{info.getValue()}</Badge>,
	}),
	columnHelper.accessor('source', {
		header: 'Source',
		enableSorting: false,
		cell: (info) => info.getValue() || '—',
	}),
	columnHelper.accessor('created_at', {
		header: 'Date',
		enableSorting: false,
		cell: (info) => <span class="cell-date">{new Date(info.getValue()).toLocaleDateString()}</span>,
	}),
];

export default function BouncesPage() {
	const session = createAsync(() => requireSession());
	const data = createAsync(() => listBounces());

	const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
	const [confirmDelete, setConfirmDelete] = createSignal(false);
	const [confirmClearAll, setConfirmClearAll] = createSignal(false);

	const table = createSolidTable({
		get data() { return data()?.bounces ?? []; },
		columns,
		state: {
			get rowSelection() { return rowSelection(); },
		},
		onRowSelectionChange: setRowSelection,
		enableRowSelection: () => can(session(), 'bounce', 'delete'),
		enableColumnFilters: false,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	const selectedRows = createMemo(() => table.getSelectedRowModel().rows.map((r) => r.original));

	async function handleDeleteSelected() {
		try {
			await deleteBounces(selectedRows().map((b) => b.id));
			toast.success(`${selectedRows().length} bounce${selectedRows().length > 1 ? 's' : ''} deleted.`);
			setRowSelection({});
			await revalidate('listBounces');
		} catch (err) {
			toastError(err, 'Failed to delete bounces.');
		}
	}

	async function handleClearAll() {
		try {
			await deleteAllBounces();
			toast.success('All bounces cleared.');
			setRowSelection({});
			await revalidate('listBounces');
		} catch (err) {
			toastError(err, 'Failed to clear bounces.');
		}
	}

	const toolbar = () => (
		<Show
			when={selectedRows().length > 0 && can(session(), 'bounce', 'delete')}
			fallback={
				<>
					<div class="dt-toolbar-spacer" />
					<Show when={can(session(), 'bounce', 'clear-all')}>
						<Button variant="danger" onClick={() => setConfirmClearAll(true)}>Clear All</Button>
					</Show>
				</>
			}
		>
			<span class="dt-selection-count">{selectedRows().length} selected</span>
			<Button variant="danger-outline" onClick={() => setConfirmDelete(true)}>Delete</Button>
			<button class="dt-clear-btn" onClick={() => setRowSelection({})}>Clear</button>
		</Show>
	);

	return (
		<>
			<PageHeader title="Bounces" />

			<DataTable table={table} toolbar={toolbar} emptyMessage="No bounces recorded." />

			<AlertDialog
				open={confirmDelete()}
				onOpenChange={setConfirmDelete}
				title={`Delete Bounce${selectedRows().length > 1 ? 's' : ''}`}
				description={`Delete ${selectedRows().length} bounce record${selectedRows().length > 1 ? 's' : ''}? This cannot be undone.`}
				confirmLabel="Yes, delete"
				onconfirm={handleDeleteSelected}
			/>

			<AlertDialog
				open={confirmClearAll()}
				onOpenChange={setConfirmClearAll}
				title="Clear All Bounces"
				description="Delete all bounce records? This cannot be undone."
				confirmLabel="Yes, clear all"
				onconfirm={handleClearAll}
			/>
		</>
	);
}
