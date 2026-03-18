<script lang="ts">
	import { Button, ConfirmDialog, EmptyState, FormField, Input, Spinner, DataTable, DialogShell } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel, getFilteredRowModel, getSortedRowModel, type SortingState, type RowSelectionState } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';
	import { listRoles, createRole, updateRole, deleteRole } from '../roles.remote';
	import { statements } from '$lib/permissions';

	let rolesQuery = $derived(listRoles());
	let _prev: typeof rolesQuery.current;
	let data = $derived.by(() => {
		const val = rolesQuery.current;
		if (val !== undefined) _prev = val;
		return val ?? _prev;
	});

	let globalFilter = $state('');
	let sorting = $state<SortingState>([]);
	let rowSelection = $state<RowSelectionState>({});

	let selectedRows = $derived.by(() => {
		if (!data) return [];
		return Object.keys(rowSelection)
			.filter((k) => rowSelection[k])
			.map((k) => data.roles[Number(k)])
			.filter(Boolean);
	});
	let selectedCount = $derived(selectedRows.length);
	// Only custom roles can be selected, so selection always means deletable

	function clearSelection() {
		rowSelection = {};
	}

	// Custom resources (exclude better-auth internals)
	const internalResources = ['organization', 'member', 'invitation', 'team', 'ac'];
	const customResources = Object.entries(statements)
		.filter(([key]) => !internalResources.includes(key))
		.map(([resource, actions]) => ({ resource, actions: [...actions] }));

	// Edit dialog
	let editOpen = $state(false);
	let editRoleId = $state('');
	let editName = $state('');
	let editOriginalName = $state('');
	let editPermissions = $state<Record<string, string[]>>({});
	let editReadOnly = $state(false);
	let savePending = $state(false);

	// Create dialog
	let createOpen = $state(false);
	let createName = $state('');
	let createPending = $state(false);

	// Delete
	let confirmDelete = $state(false);

	function openEdit(role: RoleItem) {
		editRoleId = role.id;
		editName = role.role;
		editOriginalName = role.role;
		editPermissions = JSON.parse(JSON.stringify(role.permission));
		editReadOnly = role.builtIn;
		editOpen = true;
	}

	function toggleAction(resource: string, action: string) {
		const current = editPermissions[resource] ?? [];
		if (current.includes(action)) {
			editPermissions[resource] = current.filter((a) => a !== action);
			if (editPermissions[resource].length === 0) {
				delete editPermissions[resource];
			}
		} else {
			editPermissions[resource] = [...current, action];
		}
		editPermissions = { ...editPermissions };
	}

	function toggleAllForResource(resource: string, actions: string[]) {
		const current = editPermissions[resource] ?? [];
		if (actions.every((a) => current.includes(a))) {
			delete editPermissions[resource];
		} else {
			editPermissions[resource] = [...actions];
		}
		editPermissions = { ...editPermissions };
	}

	async function handleSave() {
		savePending = true;
		try {
			await updateRole({
				roleId: editRoleId,
				roleName: editName !== editOriginalName ? editName : undefined,
				permissions: editPermissions,
			});
			editOpen = false;
			toast.success('Role updated.');
			listRoles().refresh();
		} catch (err: any) {
			toast.error(err?.message || 'Failed to update role.');
		} finally {
			savePending = false;
		}
	}

	async function handleCreate() {
		createPending = true;
		try {
			await createRole({ role: createName, permissions: clonePermissions ?? {} });
			createOpen = false;
			createName = '';
			clonePermissions = null;
			toast.success('Role created.');
			listRoles().refresh();
		} catch (err: any) {
			toast.error(err?.message || 'Failed to create role.');
		} finally {
			createPending = false;
		}
	}

	async function handleDeleteSelected() {
		try {
			for (const role of selectedRows) {
				await deleteRole(role.id);
			}
			toast.success(`${selectedCount} role${selectedCount > 1 ? 's' : ''} deleted.`);
			clearSelection();
			listRoles().refresh();
		} catch (err: any) {
			toast.error(err?.message || 'Failed to delete role.');
		}
	}

	function openClone(role: RoleItem) {
		createName = `${role.role} (copy)`;
		clonePermissions = JSON.parse(JSON.stringify(role.permission));
		createOpen = true;
	}

	let clonePermissions = $state<Record<string, string[]> | null>(null);

	function resourceLabel(resource: string) {
		const labels: Record<string, string> = {
			shortlink: 'Shortlinks',
			template: 'Email Templates',
			subscriber: 'Subscribers',
			list: 'Mailing Lists',
			bounce: 'Bounces',
			analytics: 'Analytics',
		};
		return labels[resource] ?? resource;
	}

	function actionLabel(action: string) {
		return action.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function permissionSummary(permission: Record<string, string[]>) {
		const count = Object.values(permission)
			.filter((actions) => actions.length > 0)
			.length;
		return `${count} resource${count !== 1 ? 's' : ''}`;
	}

	type RoleItem = {
		id: string;
		role: string;
		permission: Record<string, string[]>;
		createdAt: Date;
		builtIn: boolean;
	};

	const columnHelper = createColumnHelper<RoleItem>();

	const columns = [
		columnHelper.display({
			id: 'select',
			header: (info) => renderSnippet(selectAllCell, info.table),
			cell: (info) => renderSnippet(selectRowCell, info.row),
			enableSorting: false,
		}),
		columnHelper.accessor('role', {
			header: 'Name',
			cell: (info) => renderSnippet(nameCell, info.row.original),
		}),
		columnHelper.display({
			id: 'permissions',
			header: 'Permissions',
			cell: (info) => renderSnippet(permCell, info.row.original),
			enableSorting: false,
		}),
	];
</script>

{#snippet selectAllCell(table: any)}
	<input type="checkbox" class="row-checkbox" checked={table.getIsAllRowsSelected()} indeterminate={table.getIsSomeRowsSelected()} onchange={table.getToggleAllRowsSelectedHandler()} />
{/snippet}

{#snippet selectRowCell(row: any)}
	<input type="checkbox" class="row-checkbox" checked={row.getIsSelected()} disabled={!row.getCanSelect()} onchange={row.getToggleSelectedHandler()} />
{/snippet}

{#snippet nameCell(role: RoleItem)}
	<button class="name-link" onclick={() => openEdit(role)}>{role.role}</button>
{/snippet}

{#snippet permCell(role: RoleItem)}
	<span class="perm-summary">{permissionSummary(role.permission)}</span>
{/snippet}

{#snippet dateCell(date: Date)}
	<span class="date">{date.toLocaleDateString()}</span>
{/snippet}

<h1>Roles & Permissions</h1>

{#if !data && rolesQuery.loading}
	<Spinner size={48} centered />
{:else if data}
	{#snippet toolbar()}
		{#if selectedCount > 0}
			<span class="toolbar-count">{selectedCount} selected</span>
			<div class="toolbar-actions">
				<Button variant="danger-outline" onclick={() => (confirmDelete = true)}>Delete</Button>
				<button class="toolbar-clear" onclick={clearSelection}>Clear</button>
			</div>
		{:else}
			<div class="toolbar-search">
				<Input type="text" placeholder="Filter roles..." bind:value={globalFilter} />
			</div>
			<Button variant="primary" onclick={() => { createName = ''; clonePermissions = null; createOpen = true; }}>+ New Role</Button>
		{/if}
	{/snippet}

	{@const table = createSvelteTable({
		data: data.roles,
		columns,
		state: { sorting, globalFilter, rowSelection },
		onSortingChange: (updater) => {
			sorting = typeof updater === 'function' ? updater(sorting) : updater;
		},
		onGlobalFilterChange: (updater) => {
			globalFilter = typeof updater === 'function' ? updater(globalFilter) : updater;
		},
		onRowSelectionChange: (updater) => {
			rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
		},
		enableRowSelection: (row) => !row.original.builtIn,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
	})}
	<DataTable {table} {toolbar} />
	{#if data.roles.length === 0}
		<EmptyState message="No custom roles defined." />
	{/if}
{/if}

<ConfirmDialog
	bind:open={confirmDelete}
	title="Delete Role{selectedCount > 1 ? 's' : ''}"
	description="Permanently delete {selectedCount} role{selectedCount > 1 ? 's' : ''}? Members with {selectedCount > 1 ? 'these roles' : 'this role'} will lose their permissions."
	confirmLabel="Yes, delete"
	onconfirm={handleDeleteSelected}
/>

<!-- Create Role Dialog -->
<DialogShell bind:open={createOpen} title="New Role">
	<div class="form-fields">
		<FormField label="Role Name" required>
			<Input bind:value={createName} placeholder="e.g. Editor" />
		</FormField>
		<div class="dialog-actions">
			<button class="cancel-btn" onclick={() => (createOpen = false)}>Cancel</button>
			<Button variant="primary" onclick={handleCreate} disabled={createPending || !createName.trim()}>
				{createPending ? 'Creating...' : 'Create'}
			</Button>
		</div>
	</div>
</DialogShell>

<!-- Edit Role Dialog -->
<DialogShell bind:open={editOpen} title={editReadOnly ? `${editName} (Built-in)` : 'Edit Role'} maxWidth="640px">
	<div class="form-fields">
		{#if !editReadOnly}
			<FormField label="Name">
				<Input bind:value={editName} />
			</FormField>
		{/if}

		<div class="perm-grid">
			{#each customResources as { resource, actions }}
				{@const currentPerms = editPermissions[resource] ?? []}
				{@const allSelected = actions.every((a) => currentPerms.includes(a))}
				<div class="perm-group">
					<label class="perm-resource">
						<input
							type="checkbox"
							checked={allSelected}
							indeterminate={currentPerms.length > 0 && !allSelected}
							disabled={editReadOnly}
							onchange={() => toggleAllForResource(resource, actions)}
						/>
						<span>{resourceLabel(resource)}</span>
					</label>
					<div class="perm-actions">
						{#each actions as action}
							<label class="perm-action">
								<input
									type="checkbox"
									checked={currentPerms.includes(action)}
									disabled={editReadOnly}
									onchange={() => toggleAction(resource, action)}
								/>
								<span>{actionLabel(action)}</span>
							</label>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<div class="dialog-actions">
			<Button variant="ghost" onclick={() => { editOpen = false; openClone({ id: editRoleId, role: editName, permission: JSON.parse(JSON.stringify(editPermissions)), createdAt: new Date(), builtIn: false }); }}>Clone</Button>
			{#if !editReadOnly}
				<div class="dialog-actions-right">
					<button class="cancel-btn" onclick={() => (editOpen = false)}>Cancel</button>
					<Button variant="primary" onclick={handleSave} disabled={savePending}>
						{savePending ? 'Saving...' : 'Save'}
					</Button>
				</div>
			{/if}
		</div>
	</div>
</DialogShell>

<style>
	h1 {
		margin: 0 0 1.5rem;
		color: var(--color-foreground);
	}

	.name-link {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-primary);
		font-weight: 600;
		font-size: inherit;
		padding: 0;
		text-transform: capitalize;
	}

	.name-link:hover {
		text-decoration: underline;
	}

	.perm-summary {
		color: var(--color-muted);
		font-size: 0.85rem;
	}

	.date {
		color: var(--color-muted);
		white-space: nowrap;
	}

	/* ─── Permission grid (in dialog) ──────────────────────────────────── */

	.perm-grid {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.perm-group {
		display: grid;
		grid-template-columns: 160px 1fr;
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid var(--color-border-light);
		align-items: start;
		gap: 0.5rem;
	}

	.perm-group:last-child {
		border-bottom: none;
	}

	.perm-resource {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--color-foreground);
		cursor: pointer;
	}

	.perm-resource input[type='checkbox'] {
		accent-color: var(--color-primary);
	}

	.perm-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 1rem;
	}

	.perm-action {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		color: var(--color-foreground);
		cursor: pointer;
		white-space: nowrap;
	}

	.perm-action input[type='checkbox'] {
		accent-color: var(--color-primary);
	}

	/* ─── Dialog shared ────────────────────────────────────────────────── */

	.form-fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.dialog-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.dialog-actions-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.cancel-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-muted);
		font-size: 0.9rem;
		padding: 0.4rem 0.75rem;
		border-radius: var(--radius-sm);
	}

	.cancel-btn:hover {
		color: var(--color-foreground);
		background: var(--color-hover);
	}

	:global(.row-checkbox) {
		width: 1rem;
		height: 1rem;
		accent-color: var(--color-primary);
		cursor: pointer;
	}

	@media (max-width: 640px) {
		.perm-group {
			grid-template-columns: 1fr;
		}
	}
</style>
