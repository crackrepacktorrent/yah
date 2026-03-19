<script lang="ts">
	import { Badge, Button, ConfirmDialog, EmptyState, FormField, Input, Select, Spinner, DataTable, DialogShell } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet, multiSelectFilter, createSelectColumn } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getFacetedRowModel, getFacetedUniqueValues, type SortingState, type RowSelectionState, type ColumnFiltersState } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';
	import { toastError } from '$lib/utils/toast-error';
	import { listTemplates, getTemplate, updateTemplate, deleteTemplate, createTemplate, setDefaultTemplate } from '../emails.remote';
	import { getSession } from '../session.remote';
	import { can } from '../can';

	let [session, templatesData] = $derived(await Promise.all([getSession(), listTemplates()]));
	let globalFilter = $state('');
	let columnFilters = $state<ColumnFiltersState>([]);

	let editOpen = $state(false);
	let editLoading = $state(false);
	let savePending = $state(false);
	let editId = $state(0);
	let editName = $state('');
	let editSubject = $state('');
	let editBody = $state('');
	let showPreview = $state(false);
	let editIsDefault = $state(false);
	let editType = $state('');

	let confirmDelete = $state(false);

	// Row selection
	let rowSelection = $state<RowSelectionState>({});
	let selectedRows = $derived.by(() => {
		if (!templatesData) return [];
		return Object.keys(rowSelection)
			.filter((k) => rowSelection[k])
			.map((k) => templatesData.templates[Number(k)])
			.filter(Boolean);
	});
	let selectedCount = $derived(selectedRows.length);
	let canDelete = $derived(can(session, 'template', 'delete') && selectedRows.every((t) => !t.is_default));

	function clearSelection() {
		rowSelection = {};
	}

	// Create dialog
	let createOpen = $state(false);
	let createPending = $state(false);
	let createName = $state('');
	let createType = $state('tx');
	let createSubject = $state('');
	let createBody = $state('');

	async function openEdit(id: number) {
		editLoading = true;
		editOpen = true;
		showPreview = false;
		try {
			const tpl = await getTemplate(id);
			editId = tpl.id;
			editName = tpl.name;
			editSubject = tpl.subject;
			editBody = tpl.body;
			editIsDefault = tpl.is_default;
			editType = tpl.type;
		} catch (err) {
			toastError(err, 'Failed to load template.');
			editOpen = false;
		} finally {
			editLoading = false;
		}
	}

	async function handleSave() {
		savePending = true;
		try {
			await updateTemplate({ id: editId, name: editName, subject: editSubject, body: editBody });
			editOpen = false;
			toast.success('Template updated.');
			listTemplates().refresh();
		} catch (err) {
			toastError(err, 'Failed to update template.');
		} finally {
			savePending = false;
		}
	}

	function openCreateTemplate() {
		createName = '';
		createType = 'tx';
		createSubject = '';
		createBody = '';
		createOpen = true;
	}

	async function handleCreateTemplate() {
		createPending = true;
		try {
			await createTemplate({ name: createName, type: createType, subject: createSubject || undefined, body: createBody });
			createOpen = false;
			toast.success('Template created.');
			listTemplates().refresh();
		} catch (err) {
			toastError(err, 'Failed to create template.');
		} finally {
			createPending = false;
		}
	}

	async function handleSetDefault() {
		try {
			await setDefaultTemplate(editId);
			editIsDefault = true;
			toast.success('Default template updated.');
			listTemplates().refresh();
		} catch (err) {
			toastError(err, 'Failed to set default template.');
		}
	}

	async function handleDelete() {
		try {
			for (const tpl of selectedRows) {
				await deleteTemplate(tpl.id);
			}
			toast.success(`${selectedCount} template${selectedCount > 1 ? 's' : ''} deleted.`);
			clearSelection();
			listTemplates().refresh();
		} catch (err) {
			toastError(err, 'Failed to delete template.');
		}
	}

	function previewHtml(html: string) {
		return html
			.replace(/\{\{\s*\.Tx\.Data\.(\w+)\s*\}\}/g, '<mark>[$1]</mark>')
			.replace(/\{\{\s*\.Subscriber\.(\w+)\s*\}\}/g, '<mark>[$1]</mark>')
			.replace(/\{\{\s*\.Campaign\.(\w+)\s*\}\}/g, '<mark>[$1]</mark>');
	}

	function typeLabel(type: string) {
		switch (type) {
			case 'tx': return 'Transactional';
			case 'campaign': return 'Campaign / HTML';
			case 'campaign_visual': return 'Campaign / Visual';
			default: return type;
		}
	}

	function typeBadgeVariant(type: string): 'default' | 'success' | 'error' | 'warning' | 'info' {
		switch (type) {
			case 'tx': return 'info';
			case 'campaign': return 'default';
			case 'campaign_visual': return 'warning';
			default: return 'default';
		}
	}

	type Template = {
		id: number;
		name: string;
		type: string;
		subject: string;
		is_default: boolean;
		created_at: string;
		updated_at: string;
	};

	const columnHelper = createColumnHelper<Template>();
	let sorting = $state<SortingState>([]);

	const columns = [
		createSelectColumn<Template>(),
		columnHelper.accessor('name', {
			header: 'Name',
			cell: (info) => renderSnippet(nameCell, info.row.original),
			enableColumnFilter: false,
		}),
		columnHelper.accessor('type', {
			header: 'Type',
			cell: (info) => renderSnippet(typeCell, info.row.original),
			enableColumnFilter: true,
			filterFn: multiSelectFilter,
		}),
		columnHelper.accessor('created_at', {
			header: 'Created',
			cell: (info) => renderSnippet(dateCell, info.getValue()),
			enableColumnFilter: false,
		}),
		columnHelper.accessor('updated_at', {
			header: 'Updated',
			cell: (info) => renderSnippet(dateCell, info.getValue()),
			enableColumnFilter: false,
		}),
	];
</script>

{#snippet nameCell(tpl: Template)}
	<button class="cell-link" onclick={() => openEdit(tpl.id)}>{tpl.name}</button>
{/snippet}

{#snippet typeCell(tpl: Template)}
	<Badge variant={typeBadgeVariant(tpl.type)}>{typeLabel(tpl.type)}</Badge>
	{#if tpl.is_default}
		<Badge variant="warning">Default</Badge>
	{/if}
{/snippet}

{#snippet dateCell(date: string)}
	<span class="cell-date">{new Date(date).toLocaleDateString()}</span>
{/snippet}


<h1>Email Templates</h1>

{#if templatesData}
	{#snippet toolbar()}
		{#if selectedCount > 0 && canDelete}
			<span class="toolbar-count">{selectedCount} selected</span>
			<div class="toolbar-actions">
				<Button variant="danger-outline" onclick={() => (confirmDelete = true)}>Delete</Button>
				<button class="toolbar-clear" onclick={clearSelection}>Clear</button>
			</div>
		{:else}
			<div class="toolbar-search">
				<Input type="text" placeholder="Filter templates..." bind:value={globalFilter} />
			</div>
			{#if can(session, 'template', 'create')}
				<Button variant="primary" onclick={openCreateTemplate}>+ New Template</Button>
			{/if}
		{/if}
	{/snippet}

	{@const table = createSvelteTable({
		data: templatesData.templates,
		columns,
		state: { sorting, rowSelection, globalFilter, columnFilters },
		onSortingChange: (updater) => {
			sorting = typeof updater === 'function' ? updater(sorting) : updater;
		},
		onRowSelectionChange: (updater) => {
			rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
		},
		onGlobalFilterChange: (updater) => {
			globalFilter = typeof updater === 'function' ? updater(globalFilter) : updater;
		},
		onColumnFiltersChange: (updater) => {
			columnFilters = typeof updater === 'function' ? updater(columnFilters) : updater;
		},
		enableColumnFilters: true,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
	})}
	<DataTable {table} {toolbar} />
	{#if templatesData.templates.length === 0}
		<EmptyState message="No email templates found." />
	{/if}
{/if}

<ConfirmDialog
	bind:open={confirmDelete}
	title="Delete Template{selectedCount > 1 ? 's' : ''}"
	description="Permanently delete {selectedCount} template{selectedCount > 1 ? 's' : ''}? This cannot be undone."
	confirmLabel="Yes, delete"
	onconfirm={handleDelete}
/>

<!-- Create Template Dialog -->
<DialogShell bind:open={createOpen} title="New Template" maxWidth="700px">
	<div class="edit-form">
		<FormField label="Name" required>
			<Input bind:value={createName} placeholder="Template name" />
		</FormField>

		<FormField label="Type">
			<Select bind:value={createType} options={[
				{ value: 'tx', label: 'Transactional' },
				{ value: 'campaign', label: 'Campaign / HTML' },
				{ value: 'campaign_visual', label: 'Campaign / Visual' },
			]} />
		</FormField>

		<FormField label="Subject" hint="Use {'{{ .Tx.Data.field }}'} for template variables">
			<Input bind:value={createSubject} placeholder="Email subject" />
		</FormField>

		<div class="body-field">
			<span class="body-label">Body (HTML)</span>
			<textarea
				class="body-editor"
				bind:value={createBody}
				rows="12"
				placeholder="<html>...</html>"
			></textarea>
			<p style="margin: 0; font-weight: 400; color: var(--color-muted); font-size: 0.8rem;">The placeholder {'{{ template "content" . }}'} should appear exactly once in the template.</p>
		</div>

		<div class="actions">
			<Button variant="ghost" onclick={() => (createOpen = false)}>Cancel</Button>
			<Button variant="primary" onclick={handleCreateTemplate} disabled={createPending}>
				{createPending ? 'Creating...' : 'Create'}
			</Button>
		</div>
	</div>
</DialogShell>

<!-- Edit Template Dialog -->
<DialogShell bind:open={editOpen} title={can(session, 'template', 'edit') ? 'Edit Template' : 'View Template'} maxWidth="700px">
	{#if editLoading}
		<Spinner size={32} centered />
	{:else}
		<div class="edit-form">
			<FormField label="Name">
				<Input bind:value={editName} disabled={!can(session, 'template', 'edit')} />
			</FormField>

			<FormField label="Subject" hint="Use {'{{ .Tx.Data.field }}'} for template variables">
				<Input bind:value={editSubject} disabled={!can(session, 'template', 'edit')} />
			</FormField>

			<div class="body-field">
				<div class="body-header">
					<span class="body-label">Body (HTML)</span>
					<button class="preview-toggle" onclick={() => (showPreview = !showPreview)}>
						{showPreview ? 'Edit' : 'Preview'}
					</button>
				</div>
				{#if showPreview}
					<iframe
						class="preview-frame"
						srcdoc={previewHtml(editBody)}
						sandbox="allow-same-origin"
						title="Template preview"
					></iframe>
				{:else}
					<textarea
						class="body-editor"
						bind:value={editBody}
						disabled={!can(session, 'template', 'edit')}
						rows="16"
					></textarea>
				{/if}
				<p style="margin: 0; font-weight: 400; color: var(--color-muted); font-size: 0.8rem;">The placeholder {'{{ template "content" . }}'} should appear exactly once in the template.</p>
			</div>

			{#if can(session, 'template', 'edit')}
				<div class="actions">
					{#if !editIsDefault && editType === 'campaign'}
						<Button variant="ghost" onclick={handleSetDefault}>Set as Default</Button>
					{/if}
					<div class="actions-right">
						<Button variant="ghost" onclick={() => (editOpen = false)}>Cancel</Button>
						<Button variant="primary" onclick={handleSave} disabled={savePending}>
							{savePending ? 'Saving...' : 'Save'}
						</Button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</DialogShell>

<style>
	h1 {
		margin: 0 0 1.5rem;
		color: var(--color-foreground);
	}

	/* ─── Edit Form ────────────────────────────────────────────────────── */

	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.body-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.body-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.body-label {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-foreground);
	}

	.preview-toggle {
		background: none;
		border: 1px solid var(--color-border);
		padding: 0.25rem 0.6rem;
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
		color: var(--color-muted);
		cursor: pointer;
	}

	.preview-toggle:hover {
		color: var(--color-foreground);
		border-color: var(--color-foreground);
	}

	.body-editor {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-foreground);
		font-family: monospace;
		font-size: 0.8rem;
		line-height: 1.5;
		resize: vertical;
	}

	.body-editor:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
	}

	.body-editor:disabled {
		opacity: 0.6;
	}

	.preview-frame {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		width: 100%;
		min-height: 300px;
		background: white;
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
		margin-top: 0.25rem;
	}

	.actions-right {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}


</style>
