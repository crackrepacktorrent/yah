import { createAsync, revalidate, type RouteDefinition } from '@solidjs/router';
import { For, Show, batch, createMemo, createSignal } from 'solid-js';
import {
	createSolidTable,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	createColumnHelper,
	type SortingState,
} from '@tanstack/solid-table';
import { toast, toastError } from '~/lib/toast';
import {
	Button,
	DataTable,
	Dialog,
	PageHeader,
	FormField,
	Input,
} from '~/components';
import { customRoleStatements, pickCustomRolePermissions } from '~/lib/permissions';
import { can } from '~/lib/can';
import { requireSession } from '~/routes/session';
import { listRoles, createRole, updateRole } from '../roles.server';
import './index.css';

export const route: RouteDefinition = {
	preload: () => {
		void listRoles();
	},
};

type RoleItem = {
	id: string;
	role: string;
	permission: Record<string, string[]>;
	createdAt: Date;
	builtIn: boolean;
};

const customResources = Object.entries(customRoleStatements).map(([resource, actions]) => ({
	resource,
	actions: [...actions] as string[],
}));

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
	const count = Object.values(pickCustomRolePermissions(permission)).filter((actions) => actions.length > 0).length;
	return `${count} resource${count !== 1 ? 's' : ''}`;
}

const columnHelper = createColumnHelper<RoleItem>();

export default function RolesPage() {
	const session = createAsync(() => requireSession());
	const data = createAsync(() => listRoles());
	const canCreate = createMemo(() => can(session(), 'ac', 'create'));
	const canUpdate = createMemo(() => can(session(), 'ac', 'update'));

	// ─── Table state ──────────────────────────────────────────────────────────────

	const [globalFilter, setGlobalFilter] = createSignal('');
	const [sorting, setSorting] = createSignal<SortingState>([]);

	// ─── Edit dialog ──────────────────────────────────────────────────────────────

	const [editOpen, setEditOpen] = createSignal(false);
	const [editId, setEditId] = createSignal('');
	const [editName, setEditName] = createSignal('');
	const [editPerms, setEditPerms] = createSignal<Record<string, string[]>>({});
	const [editReadOnly, setEditReadOnly] = createSignal(false);
	const [savePending, setSavePending] = createSignal(false);

	// ─── Create dialog ────────────────────────────────────────────────────────────

	const [createOpen, setCreateOpen] = createSignal(false);
	const [createName, setCreateName] = createSignal('');
	const [createPending, setCreatePending] = createSignal(false);
	const [clonePerms, setClonePerms] = createSignal<Record<string, string[]> | null>(null);

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
			setEditPerms(structuredClone(role.permission));
			setEditReadOnly(role.builtIn || !canUpdate());
			setEditOpen(true);
		});
	}

	function openClone(role: RoleItem) {
		batch(() => {
			setCreateName(`${role.role} (copy)`);
			setClonePerms(pickCustomRolePermissions(role.permission));
			setEditOpen(false);
			setCreateOpen(true);
		});
	}

	async function handleSave() {
		setSavePending(true);
		try {
			await updateRole({
				roleId: editId(),
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

	// ─── Table ───────────────────────────────────────────────────────────────────

	const columns = [
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
			cell: (info) => <span class="perm-summary">{permissionSummary(info.row.original.permission)}</span>,
		}),
		columnHelper.accessor('builtIn', {
			header: 'Type',
			enableSorting: false,
			cell: (info) => <span class="cell-muted">{info.getValue() ? 'Built-in' : 'Custom'}</span>,
		}),
	];

	const table = createSolidTable({
		get data() {
			return data()?.roles ?? [];
		},
		columns,
		state: {
			get globalFilter() {
				return globalFilter();
			},
			get sorting() {
				return sorting();
			},
		},
		onGlobalFilterChange: setGlobalFilter,
		onSortingChange: setSorting,
		enableColumnFilters: false,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	const toolbar = () => (
		<div class="dt-toolbar-search">
			<input
				class="admin-input"
				type="text"
				placeholder="Filter roles…"
				value={globalFilter()}
				onInput={(e) => setGlobalFilter(e.currentTarget.value)}
			/>
			<Show when={canCreate()}>
				<Button
					onClick={() => {
						setCreateName('');
						setClonePerms(null);
						setCreateOpen(true);
					}}
				>
					+ New Role
				</Button>
			</Show>
		</div>
	);

	return (
		<>
			<PageHeader title="Roles & Permissions" />

			<DataTable table={table} toolbar={toolbar} />

			{/* Create dialog */}
			<Dialog
				open={createOpen()}
				onOpenChange={setCreateOpen}
				title="New Role"
				footer={
					<>
						<Button variant="ghost" onClick={() => setCreateOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleCreate} disabled={createPending() || !createName().trim()}>
							{createPending() ? 'Creating…' : 'Create'}
						</Button>
					</>
				}
			>
				<div class="form-fields">
					<FormField label="Role Name" required>
						<Input placeholder="e.g. Editor" value={createName()} onInput={(e) => setCreateName(e.currentTarget.value)} />
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
				title={`${editName()}${editReadOnly() ? ' (Read only)' : ''}`}
				maxWidth="640px"
				footer={
					<>
						<Show when={canCreate()}>
							<Button
								variant="ghost"
								class="mr-auto"
								onClick={() =>
									openClone({
										id: editId(),
										role: editName(),
										permission: structuredClone(editPerms()),
										createdAt: new Date(),
										builtIn: false,
									})
								}
							>
								Clone
							</Button>
						</Show>
						<Show when={!editReadOnly()}>
							<Button variant="ghost" onClick={() => setEditOpen(false)}>
								Cancel
							</Button>
							<Button onClick={handleSave} disabled={savePending()}>
								{savePending() ? 'Saving…' : 'Save'}
							</Button>
						</Show>
					</>
				}
			>
				<div class="form-fields">
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
