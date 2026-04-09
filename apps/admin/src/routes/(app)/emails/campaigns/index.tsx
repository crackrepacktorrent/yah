import { createAsync, revalidate, type RouteDefinition } from '@solidjs/router';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { createSolidTable, getCoreRowModel, getFilteredRowModel, getFacetedRowModel, getFacetedUniqueValues, createColumnHelper, type ColumnFiltersState } from '@tanstack/solid-table';
import { toast } from 'solid-sonner';
import {
	Badge, Button, AlertDialog, DataTable, PageHeader,
	createSelectColumn, multiSelectFilter, type RowSelectionState,
} from '~/components';
import { requireSession } from '~/routes/session';
import { can } from '~/lib/can';
import { campaignStatusVariant, toastError } from '~/lib/utils';
import { listCampaigns, deleteCampaigns, updateCampaignStatus } from '../campaigns.server';
import './index.css';

export const route: RouteDefinition = {
	preload: () => { void listCampaigns(); },
};

type Campaign = {
	id: number;
	name: string;
	subject: string;
	from_email: string;
	status: string;
	send_at: string | null;
	started_at: string | null;
	to_send: number;
	sent: number;
	views: number;
	clicks: number;
	bounces: number;
	lists: { id: number; name: string }[];
	tags: string[];
	created_at: string;
	updated_at: string;
};

function formatNumber(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}

const columnHelper = createColumnHelper<Campaign>();

export default function CampaignsPage() {
	const session = createAsync(() => requireSession());
	const data = createAsync(() => listCampaigns());

	// ─── State ───────────────────────────────────────────────────────────────────

	const [globalFilter, setGlobalFilter] = createSignal('');
	const [columnFilters, setColumnFilters] = createSignal<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
	const [confirmDelete, setConfirmDelete] = createSignal(false);
	const [confirmSend, setConfirmSend] = createSignal(false);
	const [sendTarget, setSendTarget] = createSignal<Campaign | null>(null);

	// ─── Handlers ─────────────────────────────────────────────────────────────────

	async function handleDelete() {
		try {
			await deleteCampaigns(selectedRows().map((c) => c.id));
			toast.success(`${selectedRows().length} campaign${selectedRows().length > 1 ? 's' : ''} deleted.`);
			setRowSelection({});
			await revalidate('listCampaigns');
		} catch (err) {
			toastError(err, 'Failed to delete campaigns.');
		}
	}

	async function handleStatusChange(campaign: Campaign, status: 'running' | 'paused' | 'cancelled' | 'scheduled') {
		try {
			await updateCampaignStatus({ id: campaign.id, status });
			toast.success('Campaign status updated.');
			await revalidate('listCampaigns');
		} catch (err) {
			toastError(err, 'Failed to update status.');
		}
	}

	async function confirmSendCampaign() {
		const target = sendTarget();
		if (!target) return;
		try {
			await updateCampaignStatus({ id: target.id, status: 'running' });
			toast.success(`Campaign "${target.name}" started.`);
			await revalidate('listCampaigns');
		} catch (err) {
			toastError(err, 'Failed to start campaign.');
		}
	}

	// ─── Columns ─────────────────────────────────────────────────────────────────

	const columns = [
		createSelectColumn<Campaign>(),
		columnHelper.accessor('name', {
			header: 'Campaign',
			enableColumnFilter: false,
			cell: (info) => (
				<div class="name-col">
					<a href={`/emails/campaigns/${info.row.original.id}`} class="cell-link">{info.getValue()}</a>
					<span class="subject-text">{info.row.original.subject}</span>
				</div>
			),
		}),
		columnHelper.accessor('status', {
			header: 'Status',
			filterFn: multiSelectFilter,
			cell: (info) => <Badge variant={campaignStatusVariant(info.getValue())}>{info.getValue()}</Badge>,
		}),
		columnHelper.accessor('lists', {
			header: 'Lists',
			enableSorting: false,
			enableColumnFilter: false,
			cell: (info) => {
				const lists = info.getValue();
				return lists.length === 0
					? <span class="cell-muted">—</span>
					: <div class="cell-badges"><For each={lists}>{(list) => <Badge>{list.name}</Badge>}</For></div>;
			},
		}),
		columnHelper.display({
			id: 'stats',
			header: 'Sent / Views / Clicks',
			cell: (info) => {
				const c = info.row.original;
				return (
					<div class="stats-col">
						<span>{formatNumber(c.sent)}</span>
						<span class="stats-sep">/</span>
						<span>{formatNumber(c.views)}</span>
						<span class="stats-sep">/</span>
						<span>{formatNumber(c.clicks)}</span>
					</div>
				);
			},
		}),
		columnHelper.accessor('created_at', {
			header: 'Created',
			enableColumnFilter: false,
			cell: (info) => <span class="cell-date">{new Date(info.getValue()).toLocaleDateString()}</span>,
		}),
		columnHelper.accessor('started_at', {
			header: 'Started',
			enableColumnFilter: false,
			cell: (info) => info.getValue()
				? <span class="cell-date">{new Date(info.getValue()!).toLocaleDateString()}</span>
				: <span class="cell-muted">—</span>,
		}),
		columnHelper.display({
			id: 'ended',
			header: 'Ended',
			cell: (info) => {
				const c = info.row.original;
				return c.status === 'finished'
					? <span class="cell-date">{new Date(c.updated_at).toLocaleDateString()}</span>
					: <span class="cell-muted">—</span>;
			},
		}),
		columnHelper.display({
			id: 'actions',
			header: '',
			cell: (info) => {
				const c = info.row.original;
				return (
					<div class="actions-col">
						<Show when={c.status === 'draft' && can(session(), 'campaign', 'send')}>
							<button class="action-btn send" onClick={() => { setSendTarget(c); setConfirmSend(true); }}>Send</button>
						</Show>
						<Show when={c.status === 'running' && can(session(), 'campaign', 'send')}>
							<button class="action-btn" onClick={() => handleStatusChange(c, 'paused')}>Pause</button>
						</Show>
						<Show when={c.status === 'paused' && can(session(), 'campaign', 'send')}>
							<button class="action-btn send" onClick={() => handleStatusChange(c, 'running')}>Resume</button>
							<button class="action-btn danger" onClick={() => handleStatusChange(c, 'cancelled')}>Cancel</button>
						</Show>
						<Show when={c.status === 'scheduled' && can(session(), 'campaign', 'send')}>
							<button class="action-btn danger" onClick={() => handleStatusChange(c, 'cancelled')}>Cancel</button>
						</Show>
					</div>
				);
			},
		}),
	];

	// ─── Table ───────────────────────────────────────────────────────────────────

	const table = createSolidTable({
		get data() { return (data()?.campaigns ?? []) as Campaign[]; },
		columns,
		state: {
			get globalFilter() { return globalFilter(); },
			get columnFilters() { return columnFilters(); },
			get rowSelection() { return rowSelection(); },
		},
		onGlobalFilterChange: setGlobalFilter,
		onColumnFiltersChange: setColumnFilters,
		onRowSelectionChange: setRowSelection,
		enableRowSelection: (row) =>
			can(session(), 'campaign', 'delete') && row.original.status === 'draft',
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
	});

	const selectedRows = createMemo(() => table.getSelectedRowModel().rows.map((r) => r.original));
	const allSelectedAreDraft = createMemo(() => selectedRows().every((c) => c.status === 'draft'));

	// ─── Toolbar ──────────────────────────────────────────────────────────────────

	const toolbar = () => (
		<Show
			when={selectedRows().length > 0}
			fallback={
				<div class="dt-toolbar-search">
					<input
						class="admin-input"
						type="text"
						placeholder="Search campaigns…"
						value={globalFilter()}
						onInput={(e) => setGlobalFilter(e.currentTarget.value)}
					/>
					<Show when={can(session(), 'campaign', 'create')}>
						<Button href="/emails/campaigns/new">+ New Campaign</Button>
					</Show>
				</div>
			}
		>
			<span class="dt-selection-count">{selectedRows().length} selected</span>
			<Show when={can(session(), 'campaign', 'delete') && allSelectedAreDraft()}>
				<Button variant="danger-outline" onClick={() => setConfirmDelete(true)}>Delete</Button>
			</Show>
			<button class="dt-clear-btn" onClick={() => setRowSelection({})}>Clear</button>
		</Show>
	);

	return (
		<>
			<PageHeader title="Campaigns" />

			<DataTable table={table} toolbar={toolbar} emptyMessage="No campaigns found." />

			<AlertDialog
				open={confirmDelete()}
				onOpenChange={setConfirmDelete}
				title={`Delete Campaign${selectedRows().length > 1 ? 's' : ''}`}
				description={`Permanently delete ${selectedRows().length} draft campaign${selectedRows().length > 1 ? 's' : ''}? This cannot be undone.`}
				confirmLabel="Yes, delete"
				onconfirm={handleDelete}
			/>

			<AlertDialog
				open={confirmSend()}
				onOpenChange={setConfirmSend}
				title="Send Campaign"
				description={`Start sending "${sendTarget()?.name}" to all subscribers on the selected lists? This cannot be undone.`}
				confirmLabel="Yes, send now"
				variant="primary"
				onconfirm={confirmSendCampaign}
			/>
		</>
	);
}
