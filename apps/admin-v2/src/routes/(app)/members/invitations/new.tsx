import { can } from '@yah/admin-core/permissions';
import { revalidate, useNavigate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo, createSignal } from 'solid-js';
import { RoleFieldset } from '~/features/membership/role-fieldset';
import {
	inviteMember,
	listPendingInvitations,
	requireMembershipRouteCapability,
} from '~/features/membership/server';
import { buildAssignableRoleOptions, type RoleOption } from '~/features/membership/ui-model';
import { listRoles } from '~/features/roles/server';
import { requireSession } from '~/platform/auth/session';
import { Breadcrumbs } from '~/ui/breadcrumbs';
import { createCommandTask } from '~/ui/command-task';
import { toast } from '~/ui/toast';
import '~/features/membership/membership.css';

export const route = defineFileRoute('/members/invitations/new', {
	preload: () => void requireMembershipRouteCapability('invite'),
});

export default function NewMemberInvitationPage() {
	const authorized = createMemo(() => requireMembershipRouteCapability('invite'));
	const session = createMemo(() => requireSession());
	const canReadAccessControl = createMemo(() => can(session(), 'ac', 'read'));
	const roleCatalog = createMemo(() => canReadAccessControl() ? listRoles() : undefined);
	const standardOptions = buildAssignableRoleOptions({ mode: 'invite', canReadAccessControl: false });

	return (
		<>
			{authorized()}
			<Show when={canReadAccessControl()} fallback={<InvitationEditor options={standardOptions} />}>
				<Show when={roleCatalog()}>
					{(catalog) => (
						<InvitationEditor
							options={buildAssignableRoleOptions({
								mode: 'invite',
								canReadAccessControl: true,
								catalogRoleKeys: catalog().roles.map((role) => role.key),
							})}
						/>
					)}
				</Show>
			</Show>
		</>
	);
}

function InvitationEditor(props: { options: RoleOption[] }) {
	const navigate = useNavigate();
	const [email, setEmail] = createSignal('');
	const [selectedRoles, setSelectedRoles] = createSignal<string[]>(['member']);
	const inviteTask = createCommandTask();

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const command = { email: email(), roles: selectedRoles() };
		await inviteTask.run(async () => {
			await inviteMember(command);
			revalidate(listPendingInvitations.key);
			toast.success('Invitation sent. Repeating the same invitation will resend its secure access email.');
			navigate('/members');
		}, 'The invitation could not be sent.');
	}

	return (
		<section class="membership-editor-page">
			<Breadcrumbs items={[{ href: '/members', label: 'Members' }, { label: 'Invite' }]} />
			<h1>Invite member</h1>
			<p>Send a secure access invitation. Sending the same email and role set again resends the invitation.</p>
			<form class="membership-form" onSubmit={(event) => void submit(event)}>
				<label class="form-field">
					<span>Email</span>
					<input
						type="email"
						name="email"
						value={email()}
						onInput={(event) => setEmail(event.currentTarget.value)}
						autocomplete="email"
						maxlength="254"
						required
					/>
				</label>
				<RoleFieldset
					options={props.options}
					selected={selectedRoles()}
					onChange={setSelectedRoles}
					disabled={inviteTask.pending()}
				/>
				{inviteTask.error() ? <p class="field-error" role="alert">{inviteTask.error()}</p> : null}
				<div class="form-actions">
					<a class="button button--secondary" href="/members">Cancel</a>
					<button
						type="submit"
						class="button"
						disabled={inviteTask.pending() || selectedRoles().length === 0}
						aria-busy={inviteTask.pending() ? 'true' : undefined}
					>
						{inviteTask.pending() ? 'Sending…' : 'Send invitation'}
					</button>
				</div>
			</form>
		</section>
	);
}
