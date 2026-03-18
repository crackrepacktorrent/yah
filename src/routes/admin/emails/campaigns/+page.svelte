<script lang="ts">
	import { Badge, Button, ConfirmDialog, EmptyState, FormField, Input, Spinner, DataTable, DialogShell } from '$lib/components/admin';
	import { onMount } from 'svelte';

	let RichTextEditor: any = $state(null);
	onMount(async () => {
		const mod = await import('$lib/components/admin/RichTextEditor.svelte');
		RichTextEditor = mod.default;
	});
	import { createSvelteTable, renderSnippet } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel, getFilteredRowModel, getFacetedRowModel, getFacetedUniqueValues, type RowSelectionState, type ColumnFiltersState } from '@tanstack/table-core';
	import { Tabs } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import { listCampaigns, createCampaign, updateCampaign, deleteCampaign, updateCampaignStatus } from '../campaigns.remote';
	import { listLists } from '../lists.remote';
	import { getSession } from '../../session.remote';
	import { can } from '../../can';

	let session = $derived(getSession().current);

	// ─── Filters ─────────────────────────────────────────────────────
	let globalFilter = $state('');
	let columnFilters = $state<ColumnFiltersState>([]);

	let campaignsQuery = $derived(listCampaigns());
	let _prev: typeof campaignsQuery.current;
	let data = $derived.by(() => {
		const val = campaignsQuery.current;
		if (val !== undefined) _prev = val;
		return val ?? _prev;
	});

	let listsQuery = $derived(listLists());

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

	// ─── Create/Edit Dialog ───────────────────────────────────────────
	let dialogOpen = $state(false);
	let dialogMode = $state<'create' | 'edit'>('create');
	let dialogPending = $state(false);
	let dialogTab = $state('campaign');

	let editId = $state(0);
	let editName = $state('');
	let editSubject = $state('');
	let editFromEmail = $state('');
	let editListIds = $state<number[]>([]);
	let editBody = $state('');
	let editContentType = $state<'richtext' | 'html' | 'markdown' | 'plain'>('richtext');
	let editTags = $state('');
	let editSendLater = $state(false);
	let editSendAt = $state('');

	// ─── Confirm Dialogs ──────────────────────────────────────────────
	let confirmDelete = $state(false);
	let confirmSend = $state(false);
	let sendTarget = $state<Campaign | null>(null);

	function openCreate() {
		dialogMode = 'create';
		dialogTab = 'campaign';
		editId = 0;
		editName = '';
		editSubject = '';
		editFromEmail = '';
		editListIds = [];
		editBody = '';
		editContentType = 'richtext';
		editTags = '';
		editSendLater = false;
		editSendAt = '';
		dialogOpen = true;
	}

	function openEdit(campaign: Campaign) {
		dialogMode = 'edit';
		dialogTab = 'campaign';
		editId = campaign.id;
		editName = campaign.name;
		editSubject = campaign.subject;
		editFromEmail = campaign.from_email;
		editListIds = campaign.lists.map((l) => l.id);
		editBody = campaign.body;
		editContentType = campaign.content_type;
		editTags = campaign.tags.join(', ');
		editSendLater = !!campaign.send_at;
		editSendAt = campaign.send_at ? campaign.send_at.slice(0, 16) : '';
		dialogOpen = true;
	}

	async function handleSave() {
		dialogPending = true;
		try {
			const tags = editTags.split(',').map((t) => t.trim()).filter(Boolean);
			if (dialogMode === 'create') {
				await createCampaign({
					name: editName,
					subject: editSubject,
					fromEmail: editFromEmail || undefined,
					lists: editListIds,
					body: editBody,
					contentType: editContentType,
					tags: tags.length ? tags : undefined,
					sendAt: editSendLater && editSendAt ? new Date(editSendAt).toISOString() : undefined,
				});
				toast.success('Campaign created.');
			} else {
				await updateCampaign({
					id: editId,
					name: editName,
					subject: editSubject,
					fromEmail: editFromEmail || undefined,
					lists: editListIds,
					body: editBody,
					contentType: editContentType,
					tags,
					sendAt: editSendLater && editSendAt ? new Date(editSendAt).toISOString() : null,
				});
				toast.success('Campaign updated.');
			}
			dialogOpen = false;
			clearSelection();
			refreshList();
		} catch (err: any) {
			toast.error(err?.message || 'Failed to save campaign.');
		} finally {
			dialogPending = false;
		}
	}

	async function handleDelete() {
		try {
			for (const c of selectedRows) {
				await deleteCampaign(c.id);
			}
			toast.success(`${selectedCount} campaign${selectedCount > 1 ? 's' : ''} deleted.`);
			clearSelection();
			refreshList();
		} catch (err: any) {
			toast.error(err?.message || 'Failed to delete campaign.');
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
			refreshList();
		} catch (err: any) {
			toast.error(err?.message || 'Failed to start campaign.');
		}
	}

	async function handleStatusChange(campaign: Campaign, status: 'running' | 'paused' | 'cancelled' | 'scheduled') {
		try {
			await updateCampaignStatus({ id: campaign.id, status });
			toast.success(`Campaign status updated.`);
			refreshList();
		} catch (err: any) {
			toast.error(err?.message || 'Failed to update status.');
		}
	}

	function refreshList() {
		listCampaigns().refresh();
	}

	function toggleListId(id: number) {
		editListIds = editListIds.includes(id)
			? editListIds.filter((x) => x !== id)
			: [...editListIds, id];
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
		body: string;
		content_type: 'richtext' | 'html' | 'markdown' | 'plain';
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

	const multiSelectFilter = (row: any, columnId: string, filterValue: unknown[]) => {
		if (!filterValue || filterValue.length === 0) return true;
		return filterValue.includes(row.getValue(columnId));
	};

	const columns = [
		columnHelper.display({
			id: 'select',
			header: (info) => renderSnippet(selectAllCell, info.table),
			cell: (info) => renderSnippet(selectRowCell, info.row),
			enableSorting: false,
			enableColumnFilter: false,
		}),
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

{#snippet selectAllCell(table: any)}
	<input
		type="checkbox"
		class="row-checkbox"
		checked={table.getIsAllRowsSelected()}
		indeterminate={table.getIsSomeRowsSelected()}
		onchange={table.getToggleAllRowsSelectedHandler()}
	/>
{/snippet}

{#snippet selectRowCell(row: any)}
	<input
		type="checkbox"
		class="row-checkbox"
		checked={row.getIsSelected()}
		onchange={row.getToggleSelectedHandler()}
	/>
{/snippet}

{#snippet nameCell(campaign: Campaign)}
	<div class="name-col">
		{#if campaign.status === 'draft' && can(session, 'campaign', 'edit')}
			<button class="name-link" onclick={() => openEdit(campaign)}>{campaign.name}</button>
		{:else}
			<span class="name-text">{campaign.name}</span>
		{/if}
		<span class="subject-text">{campaign.subject}</span>
	</div>
{/snippet}

{#snippet statusCell(campaign: Campaign)}
	<Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
{/snippet}

{#snippet listsCell(lists: { id: number; name: string }[])}
	<div class="list-badges">
		{#each lists as list}
			<Badge>{list.name}</Badge>
		{/each}
		{#if lists.length === 0}
			<span class="muted">—</span>
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
	<span class="date">{new Date(date).toLocaleDateString()}</span>
{/snippet}

{#snippet optionalDateCell(date: string | null)}
	{#if date}
		<span class="date">{new Date(date).toLocaleDateString()}</span>
	{:else}
		<span class="muted">—</span>
	{/if}
{/snippet}

{#snippet actionsCell(campaign: Campaign)}
	<div class="actions-col">
		{#if campaign.status === 'draft' && can(session, 'campaign', 'send')}
			<button class="action-btn send" onclick={() => handleSendNow(campaign)} title="Send now">
				Send
			</button>
		{/if}
		{#if campaign.status === 'running' && can(session, 'campaign', 'send')}
			<button class="action-btn" onclick={() => handleStatusChange(campaign, 'paused')} title="Pause">
				Pause
			</button>
		{/if}
		{#if campaign.status === 'paused' && can(session, 'campaign', 'send')}
			<button class="action-btn send" onclick={() => handleStatusChange(campaign, 'running')} title="Resume">
				Resume
			</button>
			<button class="action-btn danger" onclick={() => handleStatusChange(campaign, 'cancelled')} title="Cancel">
				Cancel
			</button>
		{/if}
		{#if campaign.status === 'scheduled' && can(session, 'campaign', 'send')}
			<button class="action-btn danger" onclick={() => handleStatusChange(campaign, 'cancelled')} title="Cancel">
				Cancel
			</button>
		{/if}
	</div>
{/snippet}

{#snippet listCheckboxes()}
	{@const allLists = listsQuery.current?.lists ?? []}
	<div class="list-checkboxes">
		{#each allLists as list}
			<label class="list-checkbox">
				<input
					type="checkbox"
					checked={editListIds.includes(list.id)}
					onchange={() => toggleListId(list.id)}
				/>
				<span>{list.name}</span>
				<Badge variant={list.type === 'public' ? 'info' : 'default'}>{list.type}</Badge>
			</label>
		{/each}
		{#if allLists.length === 0}
			<span class="muted">No lists available</span>
		{/if}
	</div>
{/snippet}

<h1>Campaigns</h1>

{#if !data && campaignsQuery.loading}
	<Spinner size={48} centered />
{:else if data}
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
				<Button variant="primary" onclick={openCreate}>+ New Campaign</Button>
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

<!-- Delete confirmation -->
<ConfirmDialog
	bind:open={confirmDelete}
	title="Delete Campaign{selectedCount > 1 ? 's' : ''}"
	description="Permanently delete {selectedCount} draft campaign{selectedCount > 1 ? 's' : ''}? This cannot be undone."
	confirmLabel="Yes, delete"
	onconfirm={handleDelete}
/>

<!-- Send confirmation -->
<ConfirmDialog
	bind:open={confirmSend}
	title="Send Campaign"
	description="Start sending &quot;{sendTarget?.name}&quot; to all subscribers on the selected lists? This cannot be undone."
	confirmLabel="Yes, send now"
	variant="primary"
	onconfirm={confirmSendCampaign}
/>

<!-- Create/Edit Campaign Dialog -->
<DialogShell bind:open={dialogOpen} title={dialogMode === 'create' ? 'New Campaign' : 'Edit Campaign'} maxWidth="700px">
	<Tabs.Root bind:value={dialogTab}>
		<Tabs.List>
			{#snippet child({ props })}
				<div {...props} class="tabs-list">
					<Tabs.Trigger value="campaign">
						{#snippet child({ props: triggerProps })}
							<button {...triggerProps} class="tab-trigger" class:active={dialogTab === 'campaign'}>Campaign</button>
						{/snippet}
					</Tabs.Trigger>
					<Tabs.Trigger value="content">
						{#snippet child({ props: triggerProps })}
							<button {...triggerProps} class="tab-trigger" class:active={dialogTab === 'content'}>Content</button>
						{/snippet}
					</Tabs.Trigger>
				</div>
			{/snippet}
		</Tabs.List>

		<Tabs.Content value="campaign">
			{#snippet child({ props })}
				<div {...props} class="tab-content">
					<div class="form-fields">
						<FormField label="Name" required>
							<Input bind:value={editName} required placeholder="My Campaign" />
						</FormField>

						<FormField label="Subject" required>
							<Input bind:value={editSubject} required placeholder="Email subject line" />
						</FormField>

						<FormField label="From Email" hint="Leave blank for default">
							<Input type="email" bind:value={editFromEmail} placeholder="noreply@example.com" />
						</FormField>

						<FormField label="Lists" required>
							{@render listCheckboxes()}
						</FormField>

						<FormField label="Tags" hint="Comma-separated">
							<Input bind:value={editTags} placeholder="newsletter, announcement" />
						</FormField>

						<div class="send-later">
							<label class="send-later-toggle">
								<input type="checkbox" bind:checked={editSendLater} />
								<span>Schedule for later</span>
							</label>
							{#if editSendLater}
								<Input type="datetime-local" bind:value={editSendAt} />
							{/if}
						</div>
					</div>
				</div>
			{/snippet}
		</Tabs.Content>

		<Tabs.Content value="content">
			{#snippet child({ props })}
				<div {...props} class="tab-content">
					<div class="form-fields">
						<FormField label="Content Type">
							<select class="select" bind:value={editContentType}>
								<option value="richtext">Rich Text</option>
								<option value="html">Raw HTML</option>
								<option value="markdown">Markdown</option>
								<option value="plain">Plain Text</option>
							</select>
						</FormField>

						{#if editContentType === 'richtext'}
							<FormField label="Body">
								{#if RichTextEditor}
								<RichTextEditor value={editBody} onchange={(html: string) => (editBody = html)} />
							{:else}
								<Spinner centered />
							{/if}
							</FormField>
						{:else}
							<FormField label="Body">
								<textarea class="textarea" bind:value={editBody} rows="12" placeholder="Email content..."></textarea>
							</FormField>
						{/if}

						<div class="template-vars">
							<span class="template-vars-label">Template variables:</span>
							<code>{'{{ .Subscriber.Name }}'}</code>
							<code>{'{{ .Subscriber.Email }}'}</code>
							<code>{'{{ .Subscriber.Attribs }}'}</code>
						</div>
					</div>
				</div>
			{/snippet}
		</Tabs.Content>
	</Tabs.Root>

	<div class="dialog-actions">
		<button type="button" class="cancel-btn" onclick={() => (dialogOpen = false)}>Cancel</button>
		<Button variant="primary" onclick={handleSave} disabled={dialogPending}>
			{dialogPending ? 'Saving...' : dialogMode === 'create' ? 'Create Draft' : 'Save'}
		</Button>
	</div>
</DialogShell>

<style>
	/* ─── Table cells ─────────────────────────────────────────────── */

	.name-col {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.name-link {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-primary);
		font-weight: 600;
		font-size: inherit;
		padding: 0;
		text-decoration: none;
		text-align: left;
	}

	.name-link:hover {
		text-decoration: underline;
	}

	.name-text {
		font-weight: 600;
		color: var(--color-foreground);
	}

	.subject-text {
		font-size: 0.8rem;
		color: var(--color-muted);
	}

	.list-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.muted {
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

	.date {
		color: var(--color-muted);
		white-space: nowrap;
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

	/* ─── Toolbar ─────────────────────────────────────────────────── */

	:global(.row-checkbox) {
		width: 1rem;
		height: 1rem;
		accent-color: var(--color-primary);
		cursor: pointer;
	}

	.toolbar-filters {
		display: flex;
		gap: 0.5rem;
		flex: 1;
	}

	/* ─── Tabs ────────────────────────────────────────────────────── */

	.tabs-list {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--color-border);
		margin-bottom: 1.25rem;
	}

	.tab-trigger {
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		color: var(--color-muted);
		font-size: 0.9rem;
		font-weight: 500;
		padding: 0.5rem 1rem;
		transition: all 0.15s ease;
	}

	.tab-trigger:hover {
		color: var(--color-foreground);
	}

	.tab-trigger.active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}

	.tab-content {
		min-height: 0;
	}

	/* ─── Form ────────────────────────────────────────────────────── */

	.textarea {
		font-family: monospace;
	}

	.list-checkboxes {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.list-checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: var(--color-foreground);
		cursor: pointer;
	}

	.list-checkbox input[type='checkbox'] {
		accent-color: var(--color-primary);
	}

	.send-later {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.send-later-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: var(--color-foreground);
		cursor: pointer;
	}

	.send-later-toggle input[type='checkbox'] {
		accent-color: var(--color-primary);
	}

	.template-vars {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		align-items: center;
		font-size: 0.8rem;
	}

	.template-vars-label {
		color: var(--color-muted);
	}

	.template-vars code {
		background: var(--color-hover);
		padding: 0.15rem 0.4rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		color: var(--color-foreground);
	}

	.dialog-actions {
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}
</style>
