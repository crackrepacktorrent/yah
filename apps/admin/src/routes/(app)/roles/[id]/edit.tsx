import { can } from '@yah/admin-core/permissions';
import { revalidate, type RouteProps } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo } from 'solid-js';
import type { Role, RoleCatalog } from '~/features/roles/contracts';
import { RoleForm, RolePermissionDetails } from '~/features/roles/form';
import { decodeRoleRouteId, roleCloneHref } from '~/features/roles/routing';
import { listRoles, updateRole } from '~/features/roles/server';
import { getSession, requireSession } from '~/platform/auth/session';
import { Breadcrumbs } from '~/ui/breadcrumbs';
import { PageHeader } from '~/ui/page-header';
import { toast } from '~/ui/toast';
import { createCommandTask } from '~/ui/command-task';
import { createPublicError } from '~/platform/errors';
import '../roles.css';

export const route = defineFileRoute('/roles/:id/edit', {
	matchFilters: { id: (segment) => decodeRoleRouteId(segment) !== '' },
	preload: () => void listRoles(),
});

export default function EditRolePage(props: RouteProps<typeof route>) {
	const roleId = createMemo(() => decodeRoleRouteId(props.params.id));
	return <Show when={roleId()} keyed>{(resolved) => <EditRoleRoute roleId={resolved} />}</Show>;
}

function EditRoleRoute(props: { roleId: string }) {
	const catalog = createMemo(() => listRoles());
	const role = createMemo(() => catalog().roles.find((candidate) => candidate.id === props.roleId));
	return (
		<Show when={role()} fallback={<RoleNotFound />}>
			{(resolved) => <RoleEditor role={resolved()} catalog={catalog()} />}
		</Show>
	);
}

function RoleEditor(props: { role: Role; catalog: RoleCatalog }) {
	const session = createMemo(() => requireSession());
	const canCreate = createMemo(() => can(session(), 'ac', 'create'));
	const canUpdate = createMemo(() => can(session(), 'ac', 'update'));
	const task = createCommandTask();

	async function handleUpdate(value: { permissions: Parameters<typeof updateRole>[0]['permissions'] }): Promise<void> {
		const roleId = props.role.id;
		await task.run(async () => {
			const result = await updateRole({ roleId, permissions: value.permissions });
			if (!result.ok) {
				throw createPublicError(result.reason === 'built-in' ? 'Built-in roles cannot be changed.' : 'This role no longer exists.', 409);
			}
			revalidate([listRoles.key, getSession.key, requireSession.key]);
			toast.success('Role permissions updated.');
		}, 'The role could not be updated.');
	}

	const editable = () => props.role.kind === 'custom' && canUpdate();
	return (
		<section class="roles-page">
			<Breadcrumbs items={[{ href: '/roles', label: 'Roles' }, { label: props.role.key }]} />
			<PageHeader title={props.role.key} description={props.role.kind === 'built-in' ? 'Built-in role · read only' : 'Custom role'}>
				<Show when={canCreate()}><a class="button button--secondary" href={roleCloneHref(props.role.id)}>Clone product permissions</a></Show>
			</PageHeader>

			<Show when={editable()} fallback={<RolePermissionDetails permissions={props.role.permissions} />}>
				<RoleForm
					mode="edit"
					initialKey={props.role.key}
					initialPermissions={props.role.kind === 'custom' ? props.role.permissions : {}}
					statements={props.catalog.statements}
					pending={task.pending()}
					error={task.error()}
					cancelHref="/roles"
					onSubmit={(value) => void handleUpdate(value)}
				/>
			</Show>

			<Show when={props.role.kind === 'custom'}>
				<p class="role-retirement-note">To retire this role, remove all of its permissions and stop assigning it. Role keys remain available so memberships and invitations cannot become dangling references.</p>
			</Show>
		</section>
	);
}

function RoleNotFound() {
	return <section class="roles-page"><h1>Role not found</h1><p>This role no longer exists.</p><a class="button button--secondary" href="/roles">Back to roles</a></section>;
}
