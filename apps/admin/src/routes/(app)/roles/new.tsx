import { revalidate, useNavigate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { customRoleStatements } from '@yah/admin-core/permissions';
import { createMemo } from 'solid-js';
import { RoleForm } from '~/features/roles/form';
import { createRole, listRoles, requireRoleRouteCapability } from '~/features/roles/server';
import { Breadcrumbs } from '~/ui/breadcrumbs';
import { toast } from '~/ui/toast';
import { createCommandTask } from '~/ui/command-task';
import { createPublicError } from '~/platform/errors';
import './roles.css';

export const route = defineFileRoute('/roles/new', {
	preload: () => void requireRoleRouteCapability('create'),
});

export default function NewRolePage() {
	const navigate = useNavigate();
	const authorized = createMemo(() => requireRoleRouteCapability('create'));
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
		}, 'The role could not be created.');
	}

	return (
		<section class="roles-page">
			{authorized()}
			<Breadcrumbs items={[{ href: '/roles', label: 'Roles' }, { label: 'New' }]} />
			<h1>New role</h1>
			<p>Create a stable role key, then grant only the product permissions this role needs.</p>
			<RoleForm
				mode="create"
				statements={customRoleStatements}
				pending={task.pending()}
				error={task.error()}
				cancelHref="/roles"
				onSubmit={(value) => void handleSubmit(value)}
			/>
		</section>
	);
}
