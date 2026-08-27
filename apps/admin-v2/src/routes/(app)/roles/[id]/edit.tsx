import { revalidate, type RouteProps } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo, createSignal } from 'solid-js';
import type { Role, RoleCatalog } from '~/features/roles/contracts';
import { RoleForm, RolePermissionDetails } from '~/features/roles/form';
import { decodeRoleRouteId, roleCloneHref } from '~/features/roles/routing';
import { listRoles, updateRole } from '~/features/roles/server';
import { requireSession } from '~/platform/auth/session';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';
import '../roles.css';

export const route = defineFileRoute('/roles/:id/edit', {
	preload: () => void listRoles(),
});

export default function EditRolePage(props: RouteProps<typeof route>) {
	const catalog = createMemo(() => listRoles());
	const role = createMemo(() => {
		const roleId = decodeRoleRouteId(props.params.id);
		return catalog().roles.find((candidate) => candidate.id === roleId);
	});
	return (
		<Show when={role()} fallback={<RoleNotFound />}>
			{(resolved) => <RoleEditor role={resolved()} catalog={catalog()} />}
		</Show>
	);
}

function RoleEditor(props: { role: Role; catalog: RoleCatalog }) {
	const session = createMemo(() => requireSession());
	const canCreate = createMemo(() => session().permissions['ac']?.includes('create') ?? false);
	const canUpdate = createMemo(() => session().permissions['ac']?.includes('update') ?? false);
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');

	async function handleUpdate(value: { permissions: Parameters<typeof updateRole>[0]['permissions'] }): Promise<void> {
		setError('');
		setPending(true);
		try {
			const result = await updateRole({ roleId: props.role.id, permissions: value.permissions });
			if (!result.ok) {
				setError(result.reason === 'built-in' ? 'Built-in roles cannot be changed.' : 'This role no longer exists.');
				return;
			}
			revalidate(listRoles.key);
			toast.success('Role permissions updated.');
		} catch (caught) {
			setError(visibleError(caught, 'The role could not be updated.'));
		} finally {
			setPending(false);
		}
	}

	const editable = () => props.role.kind === 'custom' && canUpdate();
	return (
		<section class="roles-page">
			<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/roles">Roles</a><span aria-hidden="true">/</span><span>{props.role.key}</span></nav>
			<header class="page-header">
				<div>
					<h1>{props.role.key}</h1>
					<p>{props.role.kind === 'built-in' ? 'Built-in role · read only' : 'Custom role'}</p>
				</div>
				<Show when={canCreate()}><a class="button button--secondary" href={roleCloneHref(props.role.id)}>Clone product permissions</a></Show>
			</header>

			<Show when={editable()} fallback={<RolePermissionDetails permissions={props.role.permissions} />}>
				<RoleForm
					mode="edit"
					initialKey={props.role.key}
					initialPermissions={props.role.kind === 'custom' ? props.role.permissions : {}}
					statements={props.catalog.statements}
					pending={pending()}
					error={error()}
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
