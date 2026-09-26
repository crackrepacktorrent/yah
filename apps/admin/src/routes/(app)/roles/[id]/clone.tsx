import { revalidate, useNavigate, type RouteProps } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { pickCustomRolePermissions } from '@yah/admin-core/permissions';
import { Show, createMemo } from 'solid-js';
import type { Role } from '~/features/roles/contracts';
import { RoleForm } from '~/features/roles/form';
import { decodeRoleRouteId, roleDetailsHref } from '~/features/roles/routing';
import { createRole, listRoles, requireRoleRouteCapability } from '~/features/roles/server';
import { Breadcrumbs } from '~/ui/breadcrumbs';
import { toast } from '~/ui/toast';
import { createCommandTask } from '~/ui/command-task';
import { createPublicError } from '~/platform/errors';
import '../roles.css';

export const route = defineFileRoute('/roles/:id/clone', {
	matchFilters: { id: (segment) => decodeRoleRouteId(segment) !== '' },
	preload: () => {
		void requireRoleRouteCapability('create');
		void listRoles();
	},
});

export default function CloneRolePage(props: RouteProps<typeof route>) {
	const roleId = createMemo(() => decodeRoleRouteId(props.params.id));
	return <Show when={roleId()} keyed>{(resolved) => <CloneRoleRoute roleId={resolved} />}</Show>;
}

function CloneRoleRoute(props: { roleId: string }) {
	const catalog = createMemo(() => listRoles());
	const role = createMemo(() => catalog().roles.find((candidate) => candidate.id === props.roleId));
	return <Show when={role()} fallback={<RoleNotFound />}>{(resolved) => <CloneRoleEditor role={resolved()} />}</Show>;
}

function CloneRoleEditor(props: { role: Role }) {
	const navigate = useNavigate();
	const authorized = createMemo(() => requireRoleRouteCapability('create'));
	const catalog = createMemo(() => listRoles());
	const task = createCommandTask();

	async function handleSubmit(value: Parameters<typeof createRole>[0]): Promise<void> {
		await task.run(async () => {
			const result = await createRole(value);
			if (!result.ok) {
				throw createPublicError('A role with this key already exists.', 409);
			}
			revalidate(listRoles.key);
			toast.success(`Role ${result.role.key} created.`);
			navigate('/roles');
		}, 'The role could not be cloned.');
	}

	return (
		<section class="roles-page">
			{authorized()}
			<Breadcrumbs items={[{ href: '/roles', label: 'Roles' }, { href: roleDetailsHref(props.role.id), label: props.role.key }, { label: 'Clone' }]} />
			<h1>Clone {props.role.key}</h1>
			<p>Only product permissions are copied. Organization, membership, invitation, team, and role-management authority are never cloned.</p>
			<RoleForm
				mode="create"
				initialKey={`${props.role.key}-copy`.slice(0, 128)}
				initialPermissions={pickCustomRolePermissions(props.role.permissions)}
				statements={catalog().statements}
				pending={task.pending()}
				error={task.error()}
				cancelHref={roleDetailsHref(props.role.id)}
				onSubmit={(value) => void handleSubmit(value)}
			/>
		</section>
	);
}

function RoleNotFound() {
	return <section class="roles-page"><h1>Role not found</h1><p>This role no longer exists.</p><a class="button button--secondary" href="/roles">Back to roles</a></section>;
}
