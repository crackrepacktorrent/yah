import { createAsync, revalidate, type RouteDefinition } from '@solidjs/router';
import { Show, batch, createMemo, createSignal } from 'solid-js';
import {
	createSolidTable,
	getCoreRowModel,
	getFilteredRowModel,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getSortedRowModel,
	createColumnHelper,
	type SortingState,
	type ColumnFiltersState,
} from '@tanstack/solid-table';
import { toast, toastError } from '~/lib/toast';
import {
	Badge,
	Button,
	Input,
	AlertDialog,
	Dialog,
	DataTable,
	PageHeader,
	FormField,
	Select,
	Spinner,
	createSelectColumn,
	multiSelectFilter,
	type RowSelectionState,
} from '~/components';
import { requireSession } from '~/routes/session';
import { can } from '~/lib/can';
import { canAccessFeature } from '~/lib/feature-policy';
import { listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate, setDefaultTemplate } from './emails.server';
import './index.css';

export const route: RouteDefinition = {
	preload: () => {
		void listTemplates();
	},
};

type Template = {
	id: number;
	name: string;
	type: string;
	subject: string;
	is_default: boolean;
	created_at: string;
	updated_at: string;
};

function typeLabel(type: string) {
	switch (type) {
		case 'tx':
			return 'Transactional';
		case 'campaign':
			return 'Campaign / HTML';
		case 'campaign_visual':
			return 'Campaign / Visual';
		default:
			return type;
	}
}

function typeBadgeVariant(type: string): 'default' | 'success' | 'error' | 'warning' | 'info' {
	switch (type) {
		case 'tx':
			return 'info';
		case 'campaign':
			return 'default';
		case 'campaign_visual':
			return 'warning';
		default:
			return 'default';
	}
}

function previewHtml(html: string) {
	return html
		.replace(/\{\{\s*\.Tx\.Data\.(\w+)\s*\}\}/g, '<mark>[$1]</mark>')
		.replace(/\{\{\s*\.Subscriber\.(\w+)\s*\}\}/g, '<mark>[$1]</mark>')
		.replace(/\{\{\s*\.Campaign\.(\w+)\s*\}\}/g, '<mark>[$1]</mark>');
}

const columnHelper = createColumnHelper<Template>();

export default function TemplatesPage() {
	const session = createAsync(() => requireSession());
	const data = createAsync(() => listTemplates());
	const canEditTemplate = createMemo(() => can(session(), 'template', 'edit'));
	const canSetDefaultTemplate = createMemo(() => canAccessFeature(session(), 'templateSetDefault'));

	// ─── State ───────────────────────────────────────────────────────────────────

	const [globalFilter, setGlobalFilter] = createSignal('');
	const [columnFilters, setColumnFilters] = createSignal<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
	const [sorting, setSorting] = createSignal<SortingState>([]);
	const [confirmDelete, setConfirmDelete] = createSignal(false);

	const [createOpen, setCreateOpen] = createSignal(false);
	const [createPending, setCreatePending] = createSignal(false);
	const [createName, setCreateName] = createSignal('');
	const [createType, setCreateType] = createSignal<'tx' | 'campaign' | 'campaign_visual'>('tx');
	const [createSubject, setCreateSubject] = createSignal('');
	const [createBody, setCreateBody] = createSignal('');

	const [editOpen, setEditOpen] = createSignal(false);
	const [editLoading, setEditLoading] = createSignal(false);
	const [savePending, setSavePending] = createSignal(false);
	const [editId, setEditId] = createSignal(0);
	const [editName, setEditName] = createSignal('');
	const [editSubject, setEditSubject] = createSignal('');
	const [editBody, setEditBody] = createSignal('');
	const [editIsDefault, setEditIsDefault] = createSignal(false);
	const [editType, setEditType] = createSignal('');
	const [showPreview, setShowPreview] = createSignal(false);

	// ─── Handlers (before columns so cell closures can reference them) ────────────

	function openCreate() {
		batch(() => {
			setCreateName('');
			setCreateType('tx');
			setCreateSubject('');
			setCreateBody('');
			setCreateOpen(true);
		});
	}

	async function openEdit(id: number) {
		batch(() => {
			setEditLoading(true);
			setEditOpen(true);
			setShowPreview(false);
		});
		try {
			const tpl = await getTemplate(id);
			batch(() => {
				setEditId(tpl.id);
				setEditName(tpl.name);
				setEditSubject(tpl.subject);
				setEditBody(tpl.body);
				setEditIsDefault(tpl.is_default);
				setEditType(tpl.type);
			});
		} catch (err) {
			toastError(err, 'Failed to load template.');
			setEditOpen(false);
		} finally {
			setEditLoading(false);
		}
	}

	// ─── Columns ─────────────────────────────────────────────────────────────────

	const columns = [
		createSelectColumn<Template>(),
		columnHelper.accessor('name', {
			header: 'Name',
			enableSorting: true,
			enableColumnFilter: false,
			cell: (info) => (
				<button class="cell-link" onClick={() => openEdit(info.row.original.id)}>
					{info.getValue()}
				</button>
			),
		}),
		columnHelper.accessor('type', {
			header: 'Type',
			filterFn: multiSelectFilter,
			cell: (info) => (
				<>
					<Badge variant={typeBadgeVariant(info.getValue())}>{typeLabel(info.getValue())}</Badge>
					<Show when={info.row.original.is_default}>
						{' '}
						<Badge variant="warning">Default</Badge>
					</Show>
				</>
			),
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
		get data() {
			return data()?.templates ?? [];
		},
		columns,
		state: {
			get globalFilter() {
				return globalFilter();
			},
			get columnFilters() {
				return columnFilters();
			},
			get rowSelection() {
				return rowSelection();
			},
			get sorting() {
				return sorting();
			},
		},
		onGlobalFilterChange: setGlobalFilter,
		onColumnFiltersChange: setColumnFilters,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		enableRowSelection: (row) => can(session(), 'template', 'delete') && !row.original.is_default,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
		getSortedRowModel: getSortedRowModel(),
	});

	const selectedRows = createMemo(() => table.getSelectedRowModel().rows.map((r) => r.original));

	async function handleCreate() {
		setCreatePending(true);
		try {
			await createTemplate({
				name: createName(),
				type: createType(),
				subject: createSubject() || undefined,
				body: createBody(),
			});
			setCreateOpen(false);
			toast.success('Template created.');
			await revalidate('listTemplates');
		} catch (err) {
			toastError(err, 'Failed to create template.');
		} finally {
			setCreatePending(false);
		}
	}

	async function handleSave() {
		setSavePending(true);
		try {
			await updateTemplate({
				id: editId(),
				name: editName(),
				subject: editSubject(),
				body: editBody(),
			});
			setEditOpen(false);
			toast.success('Template updated.');
			await revalidate('listTemplates');
		} catch (err) {
			toastError(err, 'Failed to update template.');
		} finally {
			setSavePending(false);
		}
	}

	async function handleSetDefault() {
		try {
			await setDefaultTemplate(editId());
			setEditIsDefault(true);
			toast.success('Default template updated.');
			await revalidate('listTemplates');
		} catch (err) {
			toastError(err, 'Failed to set default template.');
		}
	}

	async function handleDelete() {
		try {
			await Promise.all(selectedRows().map((t) => deleteTemplate(t.id)));
			toast.success(`${selectedRows().length} template${selectedRows().length > 1 ? 's' : ''} deleted.`);
			setRowSelection({});
			await revalidate('listTemplates');
		} catch (err) {
			toastError(err, 'Failed to delete templates.');
		}
	}

	// ─── Toolbar ──────────────────────────────────────────────────────────────────

	const toolbar = () => (
		<Show
			when={selectedRows().length > 0 && can(session(), 'template', 'delete')}
			fallback={
				<div class="dt-toolbar-search">
					<input
						class="admin-input"
						type="text"
						placeholder="Filter templates…"
						value={globalFilter()}
						onInput={(e) => setGlobalFilter(e.currentTarget.value)}
					/>
					<Show when={can(session(), 'template', 'create')}>
						<Button onClick={openCreate}>+ New Template</Button>
					</Show>
				</div>
			}
		>
			<span class="dt-selection-count">{selectedRows().length} selected</span>
			<Button variant="danger-outline" onClick={() => setConfirmDelete(true)}>
				Delete
			</Button>
			<button class="dt-clear-btn" onClick={() => setRowSelection({})}>
				Clear
			</button>
		</Show>
	);

	return (
		<>
			<PageHeader title="Email Templates" />

			<DataTable table={table} toolbar={toolbar} emptyMessage="No email templates found." />

			<AlertDialog
				open={confirmDelete()}
				onOpenChange={setConfirmDelete}
				title={`Delete Template${selectedRows().length > 1 ? 's' : ''}`}
				description={`Permanently delete ${selectedRows().length} template${selectedRows().length > 1 ? 's' : ''}? This cannot be undone.`}
				confirmLabel="Yes, delete"
				onconfirm={handleDelete}
			/>

			{/* Create dialog */}
			<Dialog
				open={createOpen()}
				onOpenChange={setCreateOpen}
				title="New Template"
				maxWidth="700px"
				footer={
					<>
						<Button variant="ghost" onClick={() => setCreateOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleCreate} disabled={createPending()}>
							{createPending() ? 'Creating…' : 'Create'}
						</Button>
					</>
				}
			>
				<div class="edit-form">
					<FormField label="Name" required>
						<Input placeholder="Template name" value={createName()} onInput={(e) => setCreateName(e.currentTarget.value)} />
					</FormField>

					<FormField label="Type">
						<Select
							value={createType()}
							onValueChange={(value) => setCreateType(value as 'tx' | 'campaign' | 'campaign_visual')}
							options={[
								{ value: 'tx', label: 'Transactional' },
								{ value: 'campaign', label: 'Campaign / HTML' },
								{ value: 'campaign_visual', label: 'Campaign / Visual' },
							]}
						/>
					</FormField>

					<FormField label="Subject" hint={`Use {{ .Tx.Data.field }} for template variables`}>
						<Input placeholder="Email subject" value={createSubject()} onInput={(e) => setCreateSubject(e.currentTarget.value)} />
					</FormField>

					<div class="body-field">
						<span class="body-label">Body (HTML)</span>
						<textarea
							class="body-editor"
							rows="12"
							placeholder="<html>...</html>"
							value={createBody()}
							onInput={(e) => setCreateBody(e.currentTarget.value)}
						/>
						<p class="body-hint">The placeholder {'{{ template "content" . }}'} should appear exactly once in the template.</p>
					</div>
				</div>
			</Dialog>

			{/* Edit dialog */}
			<Dialog
				open={editOpen()}
				onOpenChange={setEditOpen}
				title={canEditTemplate() ? 'Edit Template' : 'View Template'}
				maxWidth="700px"
				footer={
					canEditTemplate() || canSetDefaultTemplate() ? (
						<>
							<Show when={canSetDefaultTemplate() && !editIsDefault() && editType() === 'campaign'}>
								<Button variant="ghost" class="mr-auto" onClick={handleSetDefault}>
									Set as Default
								</Button>
							</Show>
							<Button variant="ghost" onClick={() => setEditOpen(false)}>
								Cancel
							</Button>
							<Show when={canEditTemplate()}>
								<Button onClick={handleSave} disabled={savePending()}>
									{savePending() ? 'Saving…' : 'Save'}
								</Button>
							</Show>
						</>
					) : undefined
				}
			>
				<Show when={!editLoading()} fallback={<Spinner size={32} centered />}>
					<div class="edit-form">
						<FormField label="Name">
							<Input value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} disabled={!canEditTemplate()} />
						</FormField>

						<FormField label="Subject" hint={`Use {{ .Tx.Data.field }} for template variables`}>
							<Input value={editSubject()} onInput={(e) => setEditSubject(e.currentTarget.value)} disabled={!canEditTemplate()} />
						</FormField>

						<div class="body-field">
							<div class="body-header">
								<span class="body-label">Body (HTML)</span>
								<button class="preview-toggle" onClick={() => setShowPreview(!showPreview())}>
									{showPreview() ? 'Edit' : 'Preview'}
								</button>
							</div>
							<Show
								when={showPreview()}
								fallback={
									<textarea
										class="body-editor"
										rows="16"
										value={editBody()}
										onInput={(e) => setEditBody(e.currentTarget.value)}
										disabled={!canEditTemplate()}
									/>
								}
							>
								<iframe class="preview-frame" srcdoc={previewHtml(editBody())} sandbox="" title="Template preview" />
							</Show>
							<p class="body-hint">The placeholder {'{{ template "content" . }}'} should appear exactly once in the template.</p>
						</div>
					</div>
				</Show>
			</Dialog>
		</>
	);
}
