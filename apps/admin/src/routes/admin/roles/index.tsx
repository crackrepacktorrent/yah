import { createAsync, revalidate, type RouteDefinition } from '@solidjs/router';
import { For, Show, batch, createMemo, createSignal } from 'solid-js';
import { createSolidTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, createColumnHelper, type SortingState } from '@tanstack/solid-table';
import { toast } from 'solid-sonner';
import {
	Button, AlertDialog, DataTable, Dialog, PageHeader,
	FormField, Input,
	createSelectColumn, type RowSelectionState,
} from '~/components/admin';
import { statements } from '~/lib/permissions';
import { toastError } from '~/lib/utils';
import { listRoles, createRole, updateRole, deleteRole } from '../roles.server';
import './index.css';

export const route: RouteDefinition = {
	preload: () => { void listRoles(); },
};

type RoleItem = {
	id: string;
	role: string;
	permission: Record<string, string[]>;
	createdAt: Date;
	builtIn: boolean;
};

const internalResources = new Set(['organization', 'member', 'invitation', 'team', 'ac']);
const customResources = Object.entries(statements)
	.filter(([key]) => !internalResources.has(key))
	.map(([resource, actions]) => ({ resource, actions: [...actions] as string[] }));

function resourceLabel(resource: string): string {
	const labels: Record<string, string> = {
		shortlink: 'Shortlinks',
		template: 'Email Templates',
		subscriber: 'Subscribers',
		list: 'Mailing Lists',
		bounce: 'Bounces',
		analytics: 'Analytics',
		settings: 'Settings',
		campaign: 'Campaigns',
	};
	return labels[resource] ?? resource;
}

function actionLabel(action: string): string {
	return action.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function permissionSummary(permission: Record<string, string[]>): string {
	const count = Object.values(permission).filter((actions) => actions.length > 0).length;
	return `${count} resource${count !== 1 ? 's' : ''}`;
}

const columnHelper = createColumnHelper<RoleItem>();

export default function RolesPage() {
	const data = createAsync(() => listRoles());

	// ─── Table state ──────────────────────────────────────────────────────────────

	const [globalFilter, setGlobalFilter] = createSignal('');
	const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
	const [sorting, setSorting] = createSignal<SortingState>([]);

	// ─── Edit dialog ──────────────────────────────────────────────────────────────

	const [editOpen, setEditOpen] = createSignal(false);
	const [editId, setEditId] = createSignal('');
	const [editName, setEditName] = createSignal('');
	const [editOriginalName, setEditOriginalName] = createSignal('');
	const [editPerms, setEditPerms] = createSignal<Record<string, string[]>>({});
	const [editReadOnly, setEditReadOnly] = createSignal(false);
	const [savePending, setSavePending] = createSignal(false);

	// ─── Create dialog ────────────────────────────────────────────────────────────

	const [createOpen, setCreateOpen] = createSignal(false);
	const [createName, setCreateName] = createSignal('');
	const [createPending, setCreatePending] = createSignal(false);
	const [clonePerms, setClonePerms] = createSignal<Record<string, string[]> | null>(null);

	// ─── Delete confirm ───────────────────────────────────────────────────────────

	const [confirmDelete, setConfirmDelete] = createSignal(false);

	// ─── Permission toggles ───────────────────────────────────────────────────────

	function toggleAction(resource: string, action: string) {
		const current = editPerms()[resource] ?? [];
		let next: string[];
		if (current.includes(action)) {
			next = current.filter((a) => a !== action);
		} else {
			next = [...current, action];
		}
		setEditPerms((p) => {
			const updated = { ...p };
			if (next.length === 0) delete updated[resource];
			else updated[resource] = next;
			return updated;
		});
	}

	function toggleAllForResource(resource: string, actions: string[]) {
		const current = editPerms()[resource] ?? [];
		const allSelected = actions.every((a) => current.includes(a));
		setEditPerms((p) => {
			const updated = { ...p };
			if (allSelected) delete updated[resource];
			else updated[resource] = [...actions];
			return updated;
		});
	}

	// ─── Handlers ─────────────────────────────────────────────────────────────────

	function openEdit(role: RoleItem) {
		batch(() => {
			setEditId(role.id);
			setEditName(role.role);
			setEditOriginalName(role.role);
			setEditPerms(structuredClone(role.permission));
			setEditReadOnly(role.builtIn);
			setEditOpen(true);
		});
	}

	function openClone(role: RoleItem) {
		batch(() => {
			setCreateName(`${role.role} (copy)`);
			setClonePerms(structuredClone(role.permission));
			setEditOpen(false);
			setCreateOpen(true);
		});
	}

	async function handleSave() {
		setSavePending(true);
		try {
			await updateRole({
				roleId: editId(),
				roleName: editName() !== editOriginalName() ? editName() : undefined,
				permissions: editPerms(),
			});
			setEditOpen(false);
			toast.success('Role updated.');
			await revalidate('listRoles');
		} catch (err) {
			toastError(err, 'Failed to update role.');
		} finally {
			setSavePending(false);
		}
	}

	async function handleCreate() {
		setCreatePending(true);
		try {
			await createRole({ role: createName(), permissions: clonePerms() ?? {} });
			batch(() => {
				setCreateOpen(false);
				setCreateName('');
				setClonePerms(null);
			});
			toast.success('Role created.');
			await revalidate('listRoles');
		} catch (err) {
			toastError(err, 'Failed to create role.');
		} finally {
			setCreatePending(false);
		}
	}

	async function handleDeleteSelected() {
		const rows = table.getSelectedRowModel().rows.map((r) => r.original);
		try {
			await Promise.all(rows.map((role) => deleteRole(role.id)));
			toast.success(`${rows.length} role${rows.length > 1 ? 's' : ''} deleted.`);
			setRowSelection({});
			await revalidate('listRoles');
		} catch (err) {
			toastError(err, 'Failed to delete role.');
		}
	}

	// ─── Table ───────────────────────────────────────────────────────────────────

	const columns = [
		createSelectColumn<RoleItem>(),
		columnHelper.accessor('role', {
			header: 'Name',
			enableSorting: true,
			cell: (info) => (
				<button class="cell-link role-name" onClick={() => openEdit(info.row.original)}>
					{info.getValue()}
				</button>
			),
		}),
		columnHelper.display({
			id: 'permissions',
			header: 'Permissions',
			enableSorting: false,
			cell: (info) => (
				<span class="perm-summary">{permissionSummary(info.row.original.permission)}</span>
			),
		}),
		columnHelper.accessor('builtIn', {
			header: 'Type',
			enableSorting: false,
			cell: (info) => (
				<span class="cell-muted">{info.getValue() ? 'Built-in' : 'Custom'}</span>
			),
		}),
	];

	const table = createSolidTable({
		get data() { return data()?.roles ?? []; },
		columns,
		state: {
			get globalFilter() { return globalFilter(); },
			get rowSelection() { return rowSelection(); },
			get sorting() { return sorting(); },
		},
		onGlobalFilterChange: setGlobalFilter,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		enableRowSelection: (row) => !row.original.builtIn,
		enableColumnFilters: false,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	const selectedRows = createMemo(() => table.getSelectedRowModel().rows.map((r) => r.original));

	const toolbar = () => (
		<Show
			when={selectedRows().length > 0}
			fallback={
				<div class="dt-toolbar-search">
					<input
						class="admin-input"
						type="text"
						placeholder="Filter roles…"
						value={globalFilter()}
						onInput={(e) => setGlobalFilter(e.currentTarget.value)}
					/>
					<Button onClick={() => { setCreateName(''); setClonePerms(null); setCreateOpen(true); }}>
						+ New Role
					</Button>
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
			<PageHeader title="Roles & Permissions" />

			<DataTable table={table} toolbar={toolbar} />

			<AlertDialog
				open={confirmDelete()}
				onOpenChange={setConfirmDelete}
				title={`Delete Role${selectedRows().length > 1 ? 's' : ''}`}
				description={`Permanently delete ${selectedRows().length} role${selectedRows().length > 1 ? 's' : ''}? Members with these roles will lose their permissions.`}
				confirmLabel="Yes, delete"
				onconfirm={handleDeleteSelected}
			/>

			{/* Create dialog */}
			<Dialog
				open={createOpen()}
				onOpenChange={setCreateOpen}
				title="New Role"
				footer={<>
					<Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
					<Button onClick={handleCreate} disabled={createPending() || !createName().trim()}>
						{createPending() ? 'Creating…' : 'Create'}
					</Button>
				</>}
			>
				<div class="form-fields">
					<FormField label="Role Name" required>
						<Input
							placeholder="e.g. Editor"
							value={createName()}
							onInput={(e) => setCreateName(e.currentTarget.value)}
						/>
					</FormField>
					<Show when={clonePerms()}>
						<p class="clone-note">Cloning permissions from existing role.</p>
					</Show>
				</div>
			</Dialog>

			{/* Edit dialog */}
			<Dialog
				open={editOpen()}
				onOpenChange={setEditOpen}
				title={editReadOnly() ? `${editName()} (Built-in)` : 'Edit Role'}
				maxWidth="640px"
				footer={<>
					<Button variant="ghost" class="mr-auto" onClick={() => openClone({ id: editId(), role: editName(), permission: structuredClone(editPerms()), createdAt: new Date(), builtIn: false })}>
						Clone
					</Button>
					<Show when={!editReadOnly()}>
						<Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
						<Button onClick={handleSave} disabled={savePending()}>
							{savePending() ? 'Saving…' : 'Save'}
						</Button>
					</Show>
				</>}
			>
				<div class="form-fields">
					<Show when={!editReadOnly()}>
						<FormField label="Name">
							<Input value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} />
						</FormField>
					</Show>

					<div class="perm-grid">
						<For each={customResources}>
							{({ resource, actions }) => {
								const currentPerms = () => editPerms()[resource] ?? [];
								const allSelected = () => actions.every((a) => currentPerms().includes(a));
								const someSelected = () => currentPerms().length > 0 && !allSelected();
								return (
									<div class="perm-group">
										<label class="perm-resource">
											<input
												type="checkbox"
												checked={allSelected()}
												prop:indeterminate={someSelected()}
												disabled={editReadOnly()}
												onChange={() => toggleAllForResource(resource, actions)}
											/>
											<span>{resourceLabel(resource)}</span>
										</label>
										<div class="perm-actions">
											<For each={actions}>
												{(action) => (
													<label class="perm-action">
														<input
															type="checkbox"
															checked={currentPerms().includes(action)}
															disabled={editReadOnly()}
															onChange={() => toggleAction(resource, action)}
														/>
														<span>{actionLabel(action)}</span>
													</label>
												)}
											</For>
										</div>
									</div>
								);
							}}
						</For>
					</div>

				</div>
			</Dialog>
		</>
	);
}
