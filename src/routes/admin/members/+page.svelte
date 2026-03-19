<script lang="ts">
	import { Button, Input, FormField, Badge, EmptyState, ConfirmDialog, DataTable, DialogShell, Select } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel } from '@tanstack/table-core';
	import { toast } from 'svelte-sonner';
	import { toastError } from '$lib/utils/toast-error';
	import { listMembers, listInvitations, inviteMember, updateMemberRole, removeMember, cancelInvitation } from '../members.remote';
	import { getSession } from '../session.remote';

	let inviteOpen = $state(false);
	let invitePending = $state(false);
	let inviteEmail = $state('');
	let inviteRole = $state<'admin' | 'member'>('member');

	let confirmRemove = $state<{ open: boolean; memberId: string; name: string }>({ open: false, memberId: '', name: '' });
	let confirmCancelInvite = $state<{ open: boolean; id: string; email: string }>({ open: false, id: '', email: '' });

	let [membersData, invitationsData, currentSession] = $derived(await Promise.all([listMembers(), listInvitations(), getSession()]));

	async function handleInvite(e: SubmitEvent) {
		e.preventDefault();
		invitePending = true;
		try {
			await inviteMember({ email: inviteEmail, role: inviteRole });
			inviteOpen = false;
			inviteEmail = '';
			inviteRole = 'member';
			toast.success('Invitation sent.');
			listInvitations().refresh();
		} catch (err) {
			toastError(err, 'Failed to send invitation.');
		} finally {
			invitePending = false;
		}
	}

	async function handleRoleChange(memberId: string, role: string) {
		try {
			await updateMemberRole({ memberId, role: role as 'owner' | 'admin' | 'member' });
			toast.success('Role updated.');
			listMembers().refresh();
		} catch (err) {
			toastError(err, 'Failed to update role.');
		}
	}

	async function handleRemove() {
		try {
			await removeMember(confirmRemove.memberId);
			toast.success('Member removed.');
			listMembers().refresh();
		} catch (err) {
			toastError(err, 'Failed to remove member.');
		}
	}

	async function handleCancelInvitation() {
		try {
			await cancelInvitation(confirmCancelInvite.id);
			toast.success('Invitation cancelled.');
			listInvitations().refresh();
		} catch (err) {
			toastError(err, 'Failed to cancel invitation.');
		}
	}

	function roleBadgeVariant(role: string): 'default' | 'success' | 'error' | 'warning' | 'info' {
		switch (role) {
			case 'owner': return 'info';
			case 'admin': return 'warning';
			default: return 'default';
		}
	}

	// ─── Members table ────────────────────────────────────────────────

	type Member = {
		id: string;
		role: string;
		user: { name: string | null; email: string };
	};

	const memberColumnHelper = createColumnHelper<Member>();

	const memberColumns = [
		memberColumnHelper.accessor((row) => row.user.name, {
			id: 'name',
			header: 'Name',
			cell: (info) => info.getValue() ?? '—',
			enableColumnFilter: false,
		}),
		memberColumnHelper.accessor((row) => row.user.email, {
			id: 'email',
			header: 'Email',
			cell: (info) => renderSnippet(emailCell, info.getValue()),
			enableColumnFilter: false,
		}),
		memberColumnHelper.accessor('role', {
			header: 'Role',
			cell: (info) => renderSnippet(roleBadgeCell, info.getValue()),
			enableColumnFilter: false,
		}),
		memberColumnHelper.display({
			id: 'actions',
			header: 'Actions',
			cell: (info) => renderSnippet(memberActionsCell, info.row.original),
			enableColumnFilter: false,
		}),
	];

	// ─── Invitations table ────────────────────────────────────────────

	type Invitation = {
		id: string;
		email: string;
		role: string;
		status: string;
	};

	const inviteColumnHelper = createColumnHelper<Invitation>();

	const inviteColumns = [
		inviteColumnHelper.accessor('email', {
			header: 'Email',
			cell: (info) => renderSnippet(emailCell, info.getValue()),
			enableColumnFilter: false,
		}),
		inviteColumnHelper.accessor('role', {
			header: 'Role',
			cell: (info) => renderSnippet(roleBadgeCell, info.getValue()),
			enableColumnFilter: false,
		}),
		inviteColumnHelper.accessor('status', {
			header: 'Status',
			cell: (info) => renderSnippet(statusCell, info.getValue()),
			enableColumnFilter: false,
		}),
		inviteColumnHelper.display({
			id: 'actions',
			header: 'Actions',
			cell: (info) => renderSnippet(inviteActionsCell, info.row.original),
			enableColumnFilter: false,
		}),
	];
</script>

{#snippet emailCell(email: string)}
	<span class="email">{email}</span>
{/snippet}

{#snippet roleBadgeCell(role: string)}
	<Badge variant={roleBadgeVariant(role)}>{role}</Badge>
{/snippet}

{#snippet statusCell(status: string)}
	<Badge>{status}</Badge>
{/snippet}

{#snippet memberActionsCell(member: Member)}
	<div class="actions-cell">
		{#if member.user.email !== currentSession?.user.email}
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
				onclick={() => (confirmRemove = { open: true, memberId: member.id, name: member.user.name ?? member.user.email })}
			>
				Remove
			</button>
		{:else}
			<span class="you-label">You</span>
		{/if}
	</div>
{/snippet}

{#snippet inviteActionsCell(invitation: Invitation)}
	{#if invitation.status === 'pending'}
		<button
			class="remove-btn"
			onclick={() => (confirmCancelInvite = { open: true, id: invitation.id, email: invitation.email })}
		>
			Cancel
		</button>
	{/if}
{/snippet}

<div class="page-header">
	<h1>Members</h1>
	<Button variant="primary" onclick={() => (inviteOpen = true)}>+ Invite Member</Button>
</div>

<section class="members-section">
	<h2>Team Members</h2>
	{#if membersData}
		{@const members = membersData.members.members}
		{#if members.length === 0}
			<EmptyState message="No members yet." />
		{:else}
			{@const table = createSvelteTable({
				data: members,
				columns: memberColumns,
				getCoreRowModel: getCoreRowModel(),
})}
			<DataTable {table} />
		{/if}
	{/if}
</section>

<section class="members-section">
	<h2>Pending Invitations</h2>
	{#if invitationsData}
		{#if invitationsData.invitations.length === 0}
			<EmptyState message="No pending invitations." />
		{:else}
			{@const table = createSvelteTable({
				data: invitationsData.invitations,
				columns: inviteColumns,
				getCoreRowModel: getCoreRowModel(),
})}
			<DataTable {table} />
		{/if}
	{/if}
</section>

<!-- Invite Dialog -->
<DialogShell bind:open={inviteOpen} title="Invite Member" maxWidth="440px">
	<form class="invite-form" onsubmit={handleInvite}>
		<FormField label="Email" required>
			<Input type="email" bind:value={inviteEmail} required placeholder="user@example.com" />
		</FormField>

		<FormField label="Role">
			<Select
				bind:value={inviteRole}
				options={[
					{ value: 'admin', label: 'Admin' },
					{ value: 'member', label: 'Member' },
				]}
			/>
		</FormField>

		<div class="dialog-actions">
			<Button variant="ghost" onclick={() => (inviteOpen = false)}>Cancel</Button>
			<Button variant="primary" type="submit" disabled={invitePending}>
				{invitePending ? 'Sending...' : 'Send Invitation'}
			</Button>
		</div>
	</form>
</DialogShell>

<ConfirmDialog
	bind:open={confirmRemove.open}
	title="Remove Member"
	description="Remove {confirmRemove.name} from the organization? They will lose access."
	confirmLabel="Yes, remove"
	onconfirm={handleRemove}
/>

<ConfirmDialog
	bind:open={confirmCancelInvite.open}
	title="Cancel Invitation"
	description="Cancel the invitation for {confirmCancelInvite.email}?"
	confirmLabel="Yes, cancel"
	onconfirm={handleCancelInvitation}
/>

<style>
	.members-section {
		margin-bottom: 2rem;
	}

	.email {
		color: var(--color-muted);
	}

	.actions-cell {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

.remove-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-destructive);
		font-size: 0.85rem;
		padding: 0.3rem 0.5rem;
		border-radius: var(--radius-sm);
	}

	.remove-btn:hover {
		background: var(--color-destructive-bg);
	}

	.you-label {
		font-size: 0.85rem;
		color: var(--color-muted);
		font-style: italic;
	}

	.invite-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
