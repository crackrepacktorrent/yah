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
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';
import '~/features/membership/membership.css';

export const route = defineFileRoute('/members/invitations/new', {
	preload: () => void requireMembershipRouteCapability('invite'),
});

export default function NewMemberInvitationPage() {
	const authorized = createMemo(() => requireMembershipRouteCapability('invite'));
	const session = createMemo(() => requireSession());
	const canReadAccessControl = createMemo(() => session().permissions['ac']?.includes('read') ?? false);
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
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		setError('');
		setPending(true);
		try {
			await inviteMember({ email: email(), roles: selectedRoles() });
			revalidate(listPendingInvitations.key);
			toast.success('Invitation sent. Repeating the same invitation will resend its secure access email.');
			navigate('/members');
		} catch (caught) {
			setError(visibleError(caught, 'The invitation could not be sent.'));
		} finally {
			setPending(false);
		}
	}

	return (
		<section class="membership-editor-page">
			<nav class="breadcrumbs" aria-label="Breadcrumb">
				<a href="/members">Members</a><span aria-hidden="true">/</span><span>Invite</span>
			</nav>
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
						{pending() ? 'Sending…' : 'Send invitation'}
					</button>
				</div>
			</form>
		</section>
	);
}
