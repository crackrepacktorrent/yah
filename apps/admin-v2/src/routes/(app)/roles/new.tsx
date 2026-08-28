import { revalidate, useNavigate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { customRoleStatements } from '@yah/admin-core/permissions';
import { createMemo, createSignal } from 'solid-js';
import { RoleForm } from '~/features/roles/form';
import { createRole, listRoles, requireRoleRouteCapability } from '~/features/roles/server';
import { Breadcrumbs } from '~/ui/breadcrumbs';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';
import './roles.css';

export const route = defineFileRoute('/roles/new', {
	preload: () => void requireRoleRouteCapability('create'),
});

export default function NewRolePage() {
	const navigate = useNavigate();
	const authorized = createMemo(() => requireRoleRouteCapability('create'));
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');

	async function handleSubmit(value: Parameters<typeof createRole>[0]): Promise<void> {
		setError('');
		setPending(true);
		try {
			const result = await createRole(value);
			if (!result.ok) {
				setError('A role with this key already exists.');
				return;
			}
			revalidate(listRoles.key);
			toast.success(`Role ${result.role.key} created.`);
			navigate('/roles');
		} catch (caught) {
			setError(visibleError(caught, 'The role could not be created.'));
		} finally {
			setPending(false);
		}
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
				pending={pending()}
				error={error()}
				cancelHref="/roles"
				onSubmit={(value) => void handleSubmit(value)}
			/>
		</section>
	);
}
