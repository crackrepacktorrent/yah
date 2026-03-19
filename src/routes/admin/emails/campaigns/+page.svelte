<script lang="ts">
	import { Badge, Button, ConfirmDialog, EmptyState, Input, DataTable } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet, multiSelectFilter, createSelectColumn } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel, getFilteredRowModel, getFacetedRowModel, getFacetedUniqueValues, type RowSelectionState, type ColumnFiltersState } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';
	import { toastError } from '$lib/utils/toast-error';
	import { listCampaigns, deleteCampaign, updateCampaignStatus } from '../campaigns.remote';
	import { getSession } from '../../session.remote';
	import { can } from '../../can';

	let session = $derived(getSession().current);

	// ─── Filters ─────────────────────────────────────────────────────
	let globalFilter = $state('');
	let columnFilters = $state<ColumnFiltersState>([]);

	let data = $derived(await listCampaigns());

	// ─── Row Selection ────────────────────────────────────────────────
	let rowSelection = $state<RowSelectionState>({});
	let selectedRows = $derived.by(() => {
		if (!data) return [];
		return Object.keys(rowSelection)
			.filter((k) => rowSelection[k])
			.map((k) => data.campaigns[Number(k)])
			.filter(Boolean);
	});
	let selectedCount = $derived(selectedRows.length);
	let allSelectedAreDraft = $derived(selectedRows.every((c) => c.status === 'draft'));

	function clearSelection() {
		rowSelection = {};
	}

	// ─── Confirm Dialogs ──────────────────────────────────────────────
	let confirmDelete = $state(false);
	let confirmSend = $state(false);
	let sendTarget = $state<Campaign | null>(null);

	async function handleDelete() {
		try {
			for (const c of selectedRows) {
				await deleteCampaign(c.id);
			}
			toast.success(`${selectedCount} campaign${selectedCount > 1 ? 's' : ''} deleted.`);
			clearSelection();
			listCampaigns().refresh();
		} catch (err) {
			toastError(err, 'Failed to delete campaign.');
		}
	}

	async function handleSendNow(campaign: Campaign) {
		sendTarget = campaign;
		confirmSend = true;
	}

	async function confirmSendCampaign() {
		if (!sendTarget) return;
		try {
			await updateCampaignStatus({ id: sendTarget.id, status: 'running' });
			toast.success(`Campaign "${sendTarget.name}" started.`);
			listCampaigns().refresh();
		} catch (err) {
			toastError(err, 'Failed to start campaign.');
		}
	}

	async function handleStatusChange(campaign: Campaign, status: 'running' | 'paused' | 'cancelled' | 'scheduled') {
		try {
			await updateCampaignStatus({ id: campaign.id, status });
			toast.success(`Campaign status updated.`);
			listCampaigns().refresh();
		} catch (err) {
			toastError(err, 'Failed to update status.');
		}
	}

	function statusVariant(status: string): 'default' | 'success' | 'error' | 'warning' | 'info' {
		switch (status) {
			case 'draft': return 'default';
			case 'running': return 'success';
			case 'paused': return 'warning';
			case 'finished': return 'info';
			case 'cancelled': return 'error';
			case 'scheduled': return 'warning';
			default: return 'default';
		}
	}

	function formatNumber(n: number): string {
		if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
		return String(n);
	}

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

	const columnHelper = createColumnHelper<Campaign>();

	const columns = [
		createSelectColumn<Campaign>(),
		columnHelper.accessor('name', {
			header: 'Campaign',
			cell: (info) => renderSnippet(nameCell, info.row.original),
			enableColumnFilter: false,
		}),
		columnHelper.accessor('status', {
			header: 'Status',
			cell: (info) => renderSnippet(statusCell, info.row.original),
			enableColumnFilter: true,
			filterFn: multiSelectFilter,
		}),
		columnHelper.accessor('lists', {
			header: 'Lists',
			cell: (info) => renderSnippet(listsCell, info.getValue()),
			enableSorting: false,
			enableColumnFilter: false,
		}),
		columnHelper.display({
			id: 'stats',
			header: 'Sent / Views / Clicks',
			cell: (info) => renderSnippet(statsCell, info.row.original),
			enableSorting: false,
			enableColumnFilter: false,
		}),
		columnHelper.accessor('created_at', {
			header: 'Created',
			cell: (info) => renderSnippet(dateCell, info.getValue()),
			enableColumnFilter: false,
		}),
		columnHelper.accessor('started_at', {
			header: 'Started',
			cell: (info) => renderSnippet(optionalDateCell, info.getValue()),
			enableColumnFilter: false,
		}),
		columnHelper.display({
			id: 'ended',
			header: 'Ended',
			cell: (info) => renderSnippet(optionalDateCell, info.row.original.status === 'finished' ? info.row.original.updated_at : null),
			enableColumnFilter: false,
		}),
		columnHelper.display({
			id: 'actions',
			header: '',
			cell: (info) => renderSnippet(actionsCell, info.row.original),
			enableSorting: false,
			enableColumnFilter: false,
		}),
	];
</script>

{#snippet nameCell(campaign: Campaign)}
	<div class="name-col">
		<a href="/admin/emails/campaigns/{campaign.id}" class="cell-link">{campaign.name}</a>
		<span class="subject-text">{campaign.subject}</span>
	</div>
{/snippet}

{#snippet statusCell(campaign: Campaign)}
	<Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
{/snippet}

{#snippet listsCell(lists: { id: number; name: string }[])}
	<div class="cell-badges">
		{#each lists as list}
			<Badge>{list.name}</Badge>
		{/each}
		{#if lists.length === 0}
			<span class="cell-muted">—</span>
		{/if}
	</div>
{/snippet}

{#snippet statsCell(campaign: Campaign)}
	<div class="stats-col">
		<span>{formatNumber(campaign.sent)}</span>
		<span class="stats-sep">/</span>
		<span>{formatNumber(campaign.views)}</span>
		<span class="stats-sep">/</span>
		<span>{formatNumber(campaign.clicks)}</span>
	</div>
{/snippet}

{#snippet dateCell(date: string)}
	<span class="cell-date">{new Date(date).toLocaleDateString()}</span>
{/snippet}

{#snippet optionalDateCell(date: string | null)}
	{#if date}
		<span class="cell-date">{new Date(date).toLocaleDateString()}</span>
	{:else}
		<span class="cell-muted">—</span>
	{/if}
{/snippet}

{#snippet actionsCell(campaign: Campaign)}
	<div class="actions-col">
		{#if campaign.status === 'draft' && can(session, 'campaign', 'send')}
			<button class="action-btn send" onclick={() => handleSendNow(campaign)} title="Send now">Send</button>
		{/if}
		{#if campaign.status === 'running' && can(session, 'campaign', 'send')}
			<button class="action-btn" onclick={() => handleStatusChange(campaign, 'paused')} title="Pause">Pause</button>
		{/if}
		{#if campaign.status === 'paused' && can(session, 'campaign', 'send')}
			<button class="action-btn send" onclick={() => handleStatusChange(campaign, 'running')} title="Resume">Resume</button>
			<button class="action-btn danger" onclick={() => handleStatusChange(campaign, 'cancelled')} title="Cancel">Cancel</button>
		{/if}
		{#if campaign.status === 'scheduled' && can(session, 'campaign', 'send')}
			<button class="action-btn danger" onclick={() => handleStatusChange(campaign, 'cancelled')} title="Cancel">Cancel</button>
		{/if}
	</div>
{/snippet}

<h1>Campaigns</h1>

{#if data}
	{#snippet toolbar()}
		{#if selectedCount > 0 && can(session, 'campaign', 'delete') && allSelectedAreDraft}
			<span class="toolbar-count">{selectedCount} selected</span>
			<div class="toolbar-actions">
				<Button variant="danger-outline" onclick={() => (confirmDelete = true)}>Delete</Button>
				<button class="toolbar-clear" onclick={clearSelection}>Clear</button>
			</div>
		{:else if selectedCount > 0}
			<span class="toolbar-count">{selectedCount} selected</span>
			<div class="toolbar-actions">
				<button class="toolbar-clear" onclick={clearSelection}>Clear</button>
			</div>
		{:else}
			<div class="toolbar-filters">
				<Input type="text" placeholder="Search campaigns..." bind:value={globalFilter} />
			</div>
			{#if can(session, 'campaign', 'create')}
				<Button variant="primary" href="/admin/emails/campaigns/new">+ New Campaign</Button>
			{/if}
		{/if}
	{/snippet}

	{@const table = createSvelteTable({
		data: data.campaigns,
		columns,
		state: { rowSelection, columnFilters, globalFilter },
		onRowSelectionChange: (updater) => {
			rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
		},
		onColumnFiltersChange: (updater) => {
			columnFilters = typeof updater === 'function' ? updater(columnFilters) : updater;
		},
		onGlobalFilterChange: (updater) => {
			globalFilter = typeof updater === 'function' ? updater(globalFilter) : updater;
		},
		enableColumnFilters: true,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
	})}
	<DataTable {table} {toolbar} pageSize={20} />
	{#if data.campaigns.length === 0}
		<EmptyState message="No campaigns found." />
	{/if}
{/if}

<ConfirmDialog
	bind:open={confirmDelete}
	title="Delete Campaign{selectedCount > 1 ? 's' : ''}"
	description="Permanently delete {selectedCount} draft campaign{selectedCount > 1 ? 's' : ''}? This cannot be undone."
	confirmLabel="Yes, delete"
	onconfirm={handleDelete}
/>

<ConfirmDialog
	bind:open={confirmSend}
	title="Send Campaign"
	description="Start sending &quot;{sendTarget?.name}&quot; to all subscribers on the selected lists? This cannot be undone."
	confirmLabel="Yes, send now"
	variant="primary"
	onconfirm={confirmSendCampaign}
/>

<style>
	.name-col {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.subject-text {
		font-size: 0.8rem;
		color: var(--color-muted);
	}

	.stats-col {
		display: flex;
		gap: 0.125rem;
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}

	.stats-sep {
		color: var(--color-muted);
	}

	.actions-col {
		display: flex;
		gap: 0.375rem;
	}

	.action-btn {
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		color: var(--color-muted);
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
	}

	.action-btn:hover {
		color: var(--color-foreground);
		background: var(--color-hover);
	}

	.action-btn.send {
		color: var(--color-primary);
		border-color: var(--color-primary);
	}

	.action-btn.send:hover {
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	.action-btn.danger {
		color: var(--brand-magenta);
		border-color: var(--brand-magenta);
	}

	.action-btn.danger:hover {
		background: color-mix(in srgb, var(--brand-magenta) 10%, transparent);
	}

	.toolbar-filters {
		display: flex;
		gap: 0.5rem;
		flex: 1;
	}
</style>
