import { revalidate, useNavigate, type RouteProps } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo, createSignal, untrack } from 'solid-js';
import type { AdminMember } from '~/features/membership/contracts';
import { RoleFieldset } from '~/features/membership/role-fieldset';
import { decodeMemberRouteId } from '~/features/membership/routing';
import { getMemberForRoleEdit, listMembers, updateMemberRoles } from '~/features/membership/server';
import { buildAssignableRoleOptions, type RoleOption } from '~/features/membership/ui-model';
import { listRoles } from '~/features/roles/server';
import { requireSession } from '~/platform/auth/session';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';
import '~/features/membership/membership.css';

export const route = defineFileRoute('/members/:id/roles', {
	matchFilters: { id: (segment) => decodeMemberRouteId(segment) !== '' },
	preload: ({ params }) => void getMemberForRoleEdit(decodeMemberRouteId(params.id)),
});

export default function MemberRoleEditPage(props: RouteProps<typeof route>) {
	const memberId = createMemo(() => decodeMemberRouteId(props.params.id));
	return <Show when={memberId()} keyed>{(resolved) => <MemberRoleRoute memberId={resolved} />}</Show>;
}

function MemberRoleRoute(props: { memberId: string }) {
	const member = createMemo(() => getMemberForRoleEdit(props.memberId));
	const session = createMemo(() => requireSession());
	const canReadAccessControl = createMemo(() => session().permissions['ac']?.includes('read') ?? false);

	return (
		<Show when={member()}>
			{(resolved) => (
				<RoleEditorGate member={resolved()} canReadAccessControl={canReadAccessControl()} />
			)}
		</Show>
	);
}

function RoleEditorGate(props: { member: AdminMember; canReadAccessControl: boolean }) {
	const roleCatalog = createMemo(() => props.canReadAccessControl ? listRoles() : undefined);
	const standardOptions = buildAssignableRoleOptions({
		mode: 'edit',
		canReadAccessControl: false,
		assignedRoles: untrack(() => props.member.roles),
	});
	return (
		<Show when={props.canReadAccessControl} fallback={<RoleEditor member={props.member} options={standardOptions} />}>
			<Show when={roleCatalog()}>
				{(catalog) => (
					<RoleEditor
						member={props.member}
						options={buildAssignableRoleOptions({
							mode: 'edit',
							canReadAccessControl: true,
							assignedRoles: props.member.roles,
							catalogRoleKeys: catalog().roles.map((role) => role.key),
						})}
					/>
				)}
			</Show>
		</Show>
	);
}

function RoleEditor(props: { member: AdminMember; options: RoleOption[] }) {
	const navigate = useNavigate();
	const [selectedRoles, setSelectedRoles] = createSignal([...untrack(() => props.member.roles)]);
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');
	const memberLabel = () => props.member.name ?? props.member.email;

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		setError('');
		setPending(true);
		try {
			await updateMemberRoles({ memberId: props.member.id, roles: selectedRoles() });
			revalidate([listMembers.key, getMemberForRoleEdit.keyFor(props.member.id)]);
			toast.success('Member roles updated.');
			navigate('/members');
		} catch (caught) {
			setError(visibleError(caught, 'The member roles could not be updated.'));
		} finally {
			setPending(false);
		}
	}

	return (
		<section class="membership-editor-page">
			<nav class="breadcrumbs" aria-label="Breadcrumb">
				<a href="/members">Members</a><span aria-hidden="true">/</span><span>Edit roles</span>
			</nav>
			<h1>Roles for {memberLabel()}</h1>
			<p>{props.member.email}</p>
			<form class="membership-form" onSubmit={(event) => void submit(event)}>
				<RoleFieldset
					options={props.options}
					selected={selectedRoles()}
					onChange={setSelectedRoles}
					disabled={pending()}
				/>
				{error() ? <p class="field-error" role="alert">{error()}</p> : null}
				<div class="form-actions">
					<a class="button button--secondary" href="/members">Cancel</a>
					<button
						type="submit"
						class="button"
						disabled={pending() || selectedRoles().length === 0}
						aria-busy={pending() ? 'true' : undefined}
					>
						{pending() ? 'Saving…' : 'Save roles'}
					</button>
				</div>
			</form>
		</section>
	);
}
