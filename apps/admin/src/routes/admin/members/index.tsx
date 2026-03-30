import { createAsync, revalidate, type RouteDefinition } from '@solidjs/router';
import { Show, createMemo, createSignal } from 'solid-js';
import { createSolidTable, getCoreRowModel, createColumnHelper } from '@tanstack/solid-table';
import { toast } from 'solid-sonner';
import {
	Badge, Button, AlertDialog, DataTable, Dialog, PageHeader,
	FormField, Input, Select,
} from '~/components/admin';
import { requireSession } from '~/routes/admin/session';
import { toastError } from '~/lib/utils';
import {
	listMembers, listInvitations,
	inviteMember, updateMemberRole, removeMember, cancelInvitation,
} from '../members.server';
import './index.css';

export const route: RouteDefinition = {
	preload: () => {
		void listMembers();
		void listInvitations();
	},
};

type Member = { id: string; role: string; user: { name: string | null; email: string } };
type Invitation = { id: string; email: string; role: string; status: string };

function roleBadgeVariant(role: string): 'default' | 'success' | 'error' | 'warning' | 'info' {
	if (role === 'owner') return 'info';
	if (role === 'admin') return 'warning';
	return 'default';
}

export default function MembersPage() {
	const session = createAsync(() => requireSession());
	const members = createAsync(() => listMembers());
	const invitations = createAsync(() => listInvitations());

	const currentEmail = createMemo(() => session()?.user.email);

	// ─── Invite dialog ───────────────────────────────────────────────────────────

	const [inviteOpen, setInviteOpen] = createSignal(false);
	const [inviteEmail, setInviteEmail] = createSignal('');
	const [inviteRole, setInviteRole] = createSignal<'admin' | 'member'>('member');
	const [invitePending, setInvitePending] = createSignal(false);

	// ─── Confirm dialogs ─────────────────────────────────────────────────────────

	const [confirmRemove, setConfirmRemove] = createSignal<{ open: boolean; memberId: string; name: string }>({
		open: false, memberId: '', name: '',
	});
	const [confirmCancel, setConfirmCancel] = createSignal<{ open: boolean; id: string; email: string }>({
		open: false, id: '', email: '',
	});

	// ─── Handlers ─────────────────────────────────────────────────────────────────

	async function handleInvite(e: SubmitEvent) {
		e.preventDefault();
		setInvitePending(true);
		try {
			await inviteMember({ email: inviteEmail(), role: inviteRole() });
			setInviteOpen(false);
			setInviteEmail('');
			setInviteRole('member');
			toast.success('Invitation sent.');
			await revalidate('listInvitations');
		} catch (err) {
			toastError(err, 'Failed to send invitation.');
		} finally {
			setInvitePending(false);
		}
	}

	async function handleRoleChange(memberId: string, role: string) {
		try {
			await updateMemberRole({ memberId, role: role as 'owner' | 'admin' | 'member' });
			toast.success('Role updated.');
			await revalidate('listMembers');
		} catch (err) {
			toastError(err, 'Failed to update role.');
		}
	}

	async function handleRemove() {
		try {
			await removeMember(confirmRemove().memberId);
			toast.success('Member removed.');
			setConfirmRemove((s) => ({ ...s, open: false }));
			await revalidate('listMembers');
		} catch (err) {
			toastError(err, 'Failed to remove member.');
		}
	}

	async function handleCancelInvitation() {
		try {
			await cancelInvitation(confirmCancel().id);
			toast.success('Invitation cancelled.');
			setConfirmCancel((s) => ({ ...s, open: false }));
			await revalidate('listInvitations');
		} catch (err) {
			toastError(err, 'Failed to cancel invitation.');
		}
	}

	// ─── Member table ─────────────────────────────────────────────────────────────

	const memberColumnHelper = createColumnHelper<Member>();

	const memberColumns = [
		memberColumnHelper.accessor((r) => r.user.name, {
			id: 'name',
			header: 'Name',
			cell: (info) => info.getValue() ?? <span class="cell-muted">—</span>,
			enableSorting: false,
		}),
		memberColumnHelper.accessor((r) => r.user.email, {
			id: 'email',
			header: 'Email',
			cell: (info) => <span class="cell-muted">{info.getValue()}</span>,
			enableSorting: false,
		}),
		memberColumnHelper.accessor('role', {
			header: 'Role',
			cell: (info) => <Badge variant={roleBadgeVariant(info.getValue())}>{info.getValue()}</Badge>,
			enableSorting: false,
		}),
		memberColumnHelper.display({
			id: 'actions',
			header: 'Actions',
			cell: (info) => {
				const member = info.row.original;
				return (
					<Show when={member.user.email !== currentEmail()} fallback={<span class="you-label">You</span>}>
						<div class="actions-cell">
							<Select
								value={member.role}
								onValueChange={(v) => handleRoleChange(member.id, v)}
								options={[
									{ value: 'owner', label: 'Owner' },
									{ value: 'admin', label: 'Admin' },
									{ value: 'member', label: 'Member' },
								]}
							/>
							<button
								class="remove-btn"
								onClick={() => setConfirmRemove({ open: true, memberId: member.id, name: member.user.name ?? member.user.email })}
							>
								Remove
							</button>
						</div>
					</Show>
				);
			},
			enableSorting: false,
		}),
	];

	// ─── Invitation table ─────────────────────────────────────────────────────────

	const inviteColumnHelper = createColumnHelper<Invitation>();

	const inviteColumns = [
		inviteColumnHelper.accessor('email', {
			header: 'Email',
			cell: (info) => <span class="cell-muted">{info.getValue()}</span>,
			enableSorting: false,
		}),
		inviteColumnHelper.accessor('role', {
			header: 'Role',
			cell: (info) => <Badge variant={roleBadgeVariant(info.getValue())}>{info.getValue()}</Badge>,
			enableSorting: false,
		}),
		inviteColumnHelper.accessor('status', {
			header: 'Status',
			cell: (info) => <Badge>{info.getValue()}</Badge>,
			enableSorting: false,
		}),
		inviteColumnHelper.display({
			id: 'actions',
			header: '',
			cell: (info) => {
				const inv = info.row.original;
				return (
					<Show when={inv.status === 'pending'}>
						<button
							class="remove-btn"
							onClick={() => setConfirmCancel({ open: true, id: inv.id, email: inv.email })}
						>
							Cancel
						</button>
					</Show>
				);
			},
			enableSorting: false,
		}),
	];

	const memberTable = createSolidTable({
		get data() { return members() ?? []; },
		columns: memberColumns,
		enableColumnFilters: false,
		getCoreRowModel: getCoreRowModel(),
	});

	const pendingInvites = createMemo(() =>
		(invitations() ?? []).filter((i) => i.status === 'pending'),
	);

	const inviteTable = createSolidTable({
		get data() { return pendingInvites(); },
		columns: inviteColumns,
		enableColumnFilters: false,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<>
			<PageHeader title="Members">
				<Button onClick={() => setInviteOpen(true)}>+ Invite Member</Button>
			</PageHeader>

			<section class="members-section">
				<h2>Team Members</h2>
				<DataTable table={memberTable} emptyMessage="No members yet." />
			</section>

			<section class="members-section">
				<h2>Pending Invitations</h2>
				<DataTable table={inviteTable} emptyMessage="No pending invitations." />
			</section>

			<Dialog
				open={inviteOpen()}
				onOpenChange={(open) => {
					if (!open) { setInviteEmail(''); setInviteRole('member'); }
					setInviteOpen(open);
				}}
				title="Invite Member"
				maxWidth="440px"
				footer={<>
					<Button variant="ghost" type="button" onClick={() => setInviteOpen(false)}>Cancel</Button>
					<Button type="submit" form="invite-form" disabled={invitePending()}>
						{invitePending() ? 'Sending…' : 'Send Invitation'}
					</Button>
				</>}
			>
				<form id="invite-form" class="form-fields" onSubmit={handleInvite}>
					<FormField label="Email" required>
						<Input
							type="email"
							placeholder="user@example.com"
							value={inviteEmail()}
							onInput={(e) => setInviteEmail(e.currentTarget.value)}
							required
						/>
					</FormField>
					<FormField label="Role">
						<Select
							value={inviteRole()}
							onValueChange={(v) => setInviteRole(v as 'admin' | 'member')}
							options={[
								{ value: 'admin', label: 'Admin' },
								{ value: 'member', label: 'Member' },
							]}
						/>
					</FormField>
				</form>
			</Dialog>

			<AlertDialog
				open={confirmRemove().open}
				onOpenChange={(open) => setConfirmRemove((s) => ({ ...s, open }))}
				title="Remove Member"
				description={`Remove ${confirmRemove().name} from the organization? They will lose access.`}
				confirmLabel="Yes, remove"
				onconfirm={handleRemove}
			/>
			<AlertDialog
				open={confirmCancel().open}
				onOpenChange={(open) => setConfirmCancel((s) => ({ ...s, open }))}
				title="Cancel Invitation"
				description={`Cancel the invitation for ${confirmCancel().email}?`}
				confirmLabel="Yes, cancel"
				onconfirm={handleCancelInvitation}
			/>
		</>
	);
}
