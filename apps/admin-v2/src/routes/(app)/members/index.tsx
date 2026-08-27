import { revalidate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { For, Show, createMemo, createSignal } from 'solid-js';
import type { AdminMember, PendingAdminInvitation } from '~/features/membership/contracts';
import { RoleBadges } from '~/features/membership/role-badges';
import { memberRolesHref } from '~/features/membership/routing';
import {
	cancelInvitation,
	listMembers,
	listPendingInvitations,
	removeMember,
} from '~/features/membership/server';
import { canManageMember } from '~/features/membership/ui-model';
import { requireSession } from '~/platform/auth/session';
import { ConfirmDialog } from '~/ui/confirm-dialog';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';
import '~/features/membership/membership.css';

export const route = defineFileRoute('/members', {
	preload: () => {
		void listMembers();
		void listPendingInvitations();
	},
});

type ConfirmTarget =
	| { kind: 'member'; member: AdminMember }
	| { kind: 'invitation'; invitation: PendingAdminInvitation }
	| null;

function formatExpiration(expiresAt: string): string {
	return new Date(expiresAt).toLocaleString();
}

export default function MembersPage() {
	const session = createMemo(() => requireSession());
	const members = createMemo(() => listMembers());
	const invitations = createMemo(() => listPendingInvitations());
	const canInvite = createMemo(() => session().permissions['invitation']?.includes('create') ?? false);
	const canCancel = createMemo(() => session().permissions['invitation']?.includes('cancel') ?? false);
	const canUpdate = createMemo(() => session().permissions['member']?.includes('update') ?? false);
	const canDelete = createMemo(() => session().permissions['member']?.includes('delete') ?? false);
	const canReadAccessControl = createMemo(() => session().permissions['ac']?.includes('read') ?? false);
	const [confirmTarget, setConfirmTarget] = createSignal<ConfirmTarget>(null);
	const memberDialogTarget = createMemo(() => {
		const target = confirmTarget();
		return target?.kind === 'member' ? target.member : undefined;
	});
	const invitationDialogTarget = createMemo(() => {
		const target = confirmTarget();
		return target?.kind === 'invitation' ? target.invitation : undefined;
	});
	const [pending, setPending] = createSignal(false);
	const [dialogError, setDialogError] = createSignal('');

	function openDialog(target: Exclude<ConfirmTarget, null>): void {
		setDialogError('');
		setConfirmTarget(target);
	}

	async function removeConfirmedMember(member: AdminMember): Promise<void> {
		setDialogError('');
		setPending(true);
		try {
			await removeMember({ memberId: member.id });
			revalidate(listMembers.key);
			setConfirmTarget(null);
			toast.success('Member removed. Their account remains available for future invitations.');
		} catch (error) {
			setDialogError(visibleError(error, 'The member could not be removed.'));
		} finally {
			setPending(false);
		}
	}

	async function cancelConfirmedInvitation(invitation: PendingAdminInvitation): Promise<void> {
		setDialogError('');
		setPending(true);
		try {
			await cancelInvitation({ invitationId: invitation.id });
			revalidate(listPendingInvitations.key);
			setConfirmTarget(null);
			toast.success('Invitation cancelled.');
		} catch (error) {
			setDialogError(visibleError(error, 'The invitation could not be cancelled.'));
		} finally {
			setPending(false);
		}
	}

	return (
		<section class="membership-page">
			<header class="page-header">
				<div>
					<p class="eyebrow">Organization access</p>
					<h1>Members</h1>
				</div>
				<Show when={canInvite()}>
					<a class="button" href="/members/invitations/new">Invite member</a>
				</Show>
			</header>

			<section class="membership-section" aria-labelledby="members-heading">
				<header class="membership-section__header">
					<h2 id="members-heading">Team members</h2>
					<p>{members().length.toLocaleString()} total</p>
				</header>
				<div class="data-table-scroll">
					<table class="data-table">
						<caption class="visually-hidden">Organization members and assigned roles</caption>
						<thead>
							<tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Roles</th><th scope="col">Actions</th></tr>
						</thead>
						<tbody>
							<Show when={members().length > 0} fallback={<tr><td colspan="4" class="membership-empty">No members found.</td></tr>}>
								<For each={members()}>
									{(member) => {
										const canEditMember = () => canManageMember(member, canUpdate(), canReadAccessControl());
										const canRemoveMember = () => canManageMember(member, canDelete(), canReadAccessControl());
										return (
											<tr>
												<td>{member.name ?? '—'}</td>
												<td>{member.email}</td>
												<td><RoleBadges roles={member.roles} /></td>
												<td>
													<Show when={!member.isSelf} fallback={<span class="you-label">You</span>}>
														<Show when={canEditMember() || canRemoveMember()} fallback={<span aria-hidden="true">—</span>}>
															<span class="membership-actions">
																<Show when={canEditMember()}>
																	<a class="button button--secondary" href={memberRolesHref(member.id)}>Edit roles</a>
																</Show>
																<Show when={canRemoveMember()}>
																	<button type="button" class="button button--danger-secondary" onClick={() => openDialog({ kind: 'member', member })}>Remove</button>
																</Show>
															</span>
														</Show>
													</Show>
												</td>
											</tr>
										);
									}}
								</For>
							</Show>
						</tbody>
					</table>
				</div>
			</section>

			<section class="membership-section" aria-labelledby="invitations-heading">
				<header class="membership-section__header">
					<h2 id="invitations-heading">Pending invitations</h2>
					<p>{invitations().length.toLocaleString()} pending</p>
				</header>
				<div class="data-table-scroll">
					<table class="data-table">
						<caption class="visually-hidden">Pending organization invitations</caption>
						<thead><tr><th scope="col">Email</th><th scope="col">Roles</th><th scope="col">Expires</th><th scope="col">Actions</th></tr></thead>
						<tbody>
							<Show when={invitations().length > 0} fallback={<tr><td colspan="4" class="membership-empty">No pending invitations.</td></tr>}>
								<For each={invitations()}>
									{(invitation) => (
										<tr>
											<td>{invitation.email}</td>
											<td><RoleBadges roles={invitation.roles} /></td>
											<td class="membership-expiry">{formatExpiration(invitation.expiresAt)}</td>
											<td>
												<Show when={canCancel()} fallback={<span aria-hidden="true">—</span>}>
													<button type="button" class="button button--danger-secondary" onClick={() => openDialog({ kind: 'invitation', invitation })}>Cancel</button>
												</Show>
											</td>
										</tr>
									)}
								</For>
							</Show>
						</tbody>
					</table>
				</div>
			</section>

			<ConfirmDialog
				open={!!memberDialogTarget()}
				title="Remove member?"
				description={memberDialogTarget() ? `Remove ${memberDialogTarget()?.email} from this organization? Their account will not be deleted.` : ''}
				confirmLabel="Remove member"
				pending={pending()}
				error={dialogError()}
				onOpenChange={(open) => !open && setConfirmTarget(null)}
				onConfirm={() => {
					const target = confirmTarget();
					if (target?.kind === 'member') void removeConfirmedMember(target.member);
				}}
			/>
			<ConfirmDialog
				open={!!invitationDialogTarget()}
				title="Cancel invitation?"
				description={invitationDialogTarget() ? `Cancel the pending invitation for ${invitationDialogTarget()?.email}?` : ''}
				confirmLabel="Cancel invitation"
				pending={pending()}
				error={dialogError()}
				onOpenChange={(open) => !open && setConfirmTarget(null)}
				onConfirm={() => {
					const target = confirmTarget();
					if (target?.kind === 'invitation') void cancelConfirmedInvitation(target.invitation);
				}}
			/>
		</section>
	);
}
