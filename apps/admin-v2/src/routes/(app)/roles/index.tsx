import { defineFileRoute } from '@solidjs/router/fs';
import { For, Show, createMemo } from 'solid-js';
import type { Role } from '~/features/roles/contracts';
import { permissionResourceCount } from '~/features/roles/form';
import { roleDetailsHref } from '~/features/roles/routing';
import { listRoles } from '~/features/roles/server';
import { requireSession } from '~/platform/auth/session';
import './roles.css';

export const route = defineFileRoute('/roles', {
	preload: () => void listRoles(),
});

export default function RolesPage() {
	const catalog = createMemo(() => listRoles());
	const session = createMemo(() => requireSession());
	const canCreate = createMemo(() => session().permissions['ac']?.includes('create') ?? false);

	return (
		<section class="roles-page">
			<header class="page-header">
				<div>
					<p class="eyebrow">Access control</p>
					<h1>Roles and permissions</h1>
				</div>
				<Show when={canCreate()}><a class="button" href="/roles/new">New role</a></Show>
			</header>
			<Show when={catalog()}>{(resolved) => <RoleTable roles={resolved().roles} />}</Show>
		</section>
	);
}

function RoleTable(props: { roles: Role[] }) {
	return (
		<div class="data-table-scroll">
				<table class="data-table">
					<caption class="visually-hidden">Organization roles</caption>
					<thead><tr><th scope="col">Role key</th><th scope="col">Permissions</th><th scope="col">Type</th><th scope="col">Created</th><th scope="col">Actions</th></tr></thead>
					<tbody>
						<Show when={props.roles.length > 0} fallback={<tr><td colspan="5">No roles found.</td></tr>}>
							<For each={props.roles}>
								{(role) => {
									const count = permissionResourceCount(role.permissions);
									return (
										<tr>
											<td><a class="role-key" href={roleDetailsHref(role.id)}>{role.key}</a></td>
											<td>{count} resource{count === 1 ? '' : 's'}</td>
											<td><span class="role-type">{role.kind === 'built-in' ? 'Built-in' : 'Custom'}</span></td>
											<td><span class="role-date">{role.createdAt ? new Date(role.createdAt).toLocaleDateString() : '—'}</span></td>
											<td><a href={roleDetailsHref(role.id)}>{role.kind === 'built-in' ? 'Inspect' : 'Manage'}</a></td>
										</tr>
									);
								}}
							</For>
						</Show>
					</tbody>
				</table>
		</div>
	);
}
