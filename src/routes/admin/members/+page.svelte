<script lang="ts">
	import { Button, Input, FormField, Badge, EmptyState, Spinner, ConfirmDialog, DataTable } from '$lib/components/admin';
	import { createSvelteTable, renderSnippet } from '$lib/components/admin';
	import { createColumnHelper, getCoreRowModel } from '@tanstack/table-core';
	import { Dialog } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import { listMembers, listInvitations, inviteMember, updateMemberRole, removeMember, cancelInvitation } from '../members.remote';
	import { getSession } from '../session.remote';

	let inviteOpen = $state(false);
	let invitePending = $state(false);
	let inviteEmail = $state('');
	let inviteRole = $state<'admin' | 'member'>('member');

	let confirmRemove = $state<{ open: boolean; memberId: string; name: string }>({ open: false, memberId: '', name: '' });
	let confirmCancelInvite = $state<{ open: boolean; id: string; email: string }>({ open: false, id: '', email: '' });

	let membersQuery = $derived(listMembers());
	let invitationsQuery = $derived(listInvitations());

	let currentSession = $derived(getSession().current);

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
		} catch (err: any) {
			toast.error(err?.message || 'Failed to send invitation.');
		} finally {
			invitePending = false;
		}
	}

	async function handleRoleChange(memberId: string, role: string) {
		try {
			await updateMemberRole({ memberId, role: role as 'owner' | 'admin' | 'member' });
			toast.success('Role updated.');
			listMembers().refresh();
		} catch (err: any) {
			toast.error(err?.message || 'Failed to update role.');
		}
	}

	async function handleRemove() {
		try {
			await removeMember(confirmRemove.memberId);
			toast.success('Member removed.');
			listMembers().refresh();
		} catch (err: any) {
			toast.error(err?.message || 'Failed to remove member.');
		}
	}

	async function handleCancelInvitation() {
		try {
			await cancelInvitation(confirmCancelInvite.id);
			toast.success('Invitation cancelled.');
			listInvitations().refresh();
		} catch (err: any) {
			toast.error(err?.message || 'Failed to cancel invitation.');
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
		}),
		memberColumnHelper.accessor((row) => row.user.email, {
			id: 'email',
			header: 'Email',
			cell: (info) => renderSnippet(emailCell, info.getValue()),
		}),
		memberColumnHelper.accessor('role', {
			header: 'Role',
			cell: (info) => renderSnippet(roleBadgeCell, info.getValue()),
		}),
		memberColumnHelper.display({
			id: 'actions',
			header: 'Actions',
			cell: (info) => renderSnippet(memberActionsCell, info.row.original),
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
		}),
		inviteColumnHelper.accessor('role', {
			header: 'Role',
			cell: (info) => renderSnippet(roleBadgeCell, info.getValue()),
		}),
		inviteColumnHelper.accessor('status', {
			header: 'Status',
			cell: (info) => renderSnippet(statusCell, info.getValue()),
		}),
		inviteColumnHelper.display({
			id: 'actions',
			header: 'Actions',
			cell: (info) => renderSnippet(inviteActionsCell, info.row.original),
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
			<select
				value={member.role}
				onchange={(e) => handleRoleChange(member.id, (e.target as HTMLSelectElement).value)}
				class="role-select"
			>
				<option value="owner">Owner</option>
				<option value="admin">Admin</option>
				<option value="member">Member</option>
			</select>
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

<div class="header">
	<h1>Members</h1>
	<Button variant="primary" onclick={() => (inviteOpen = true)}>+ Invite Member</Button>
</div>

<section class="members-section">
	<h2>Team Members</h2>

	{#await membersQuery}
		<Spinner size={48} centered />
	{:then data}
		{@const members = data.members.members}
		{#if members.length === 0}
			<EmptyState message="No members yet." />
		{:else}
			{@const table = createSvelteTable(() => ({
				data: members,
				columns: memberColumns,
				getCoreRowModel: getCoreRowModel(),
			}))}
			<DataTable {table} />
		{/if}
	{/await}
</section>

<section class="members-section">
	<h2>Pending Invitations</h2>

	{#await invitationsQuery}
		<Spinner size={32} centered />
	{:then data}
		{#if data.invitations.length === 0}
			<EmptyState message="No pending invitations." />
		{:else}
			{@const table = createSvelteTable(() => ({
				data: data.invitations,
				columns: inviteColumns,
				getCoreRowModel: getCoreRowModel(),
			}))}
			<DataTable {table} />
		{/if}
	{/await}
</section>

<!-- Invite Dialog -->
<Dialog.Root bind:open={inviteOpen}>
	<Dialog.Portal>
		<Dialog.Overlay>
			{#snippet child({ props })}
				<div {...props} class="dialog-overlay"></div>
			{/snippet}
		</Dialog.Overlay>
		<Dialog.Content>
			{#snippet child({ props })}
				<div {...props} class="dialog-content">
					<div class="dialog-header">
						<h2>Invite Member</h2>
						<Dialog.Close>
							{#snippet child({ props: closeProps })}
								<button {...closeProps} class="dialog-close">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<line x1="18" y1="6" x2="6" y2="18"></line>
										<line x1="6" y1="6" x2="18" y2="18"></line>
									</svg>
								</button>
							{/snippet}
						</Dialog.Close>
					</div>

					<form class="invite-form" onsubmit={handleInvite}>
						<FormField label="Email" required>
							<Input type="email" bind:value={inviteEmail} required placeholder="user@example.com" />
						</FormField>

						<FormField label="Role">
							<select bind:value={inviteRole} class="role-select full-width">
								<option value="admin">Admin</option>
								<option value="member">Member</option>
							</select>
						</FormField>

						<div class="dialog-actions">
							<button type="button" class="cancel-btn" onclick={() => (inviteOpen = false)}>Cancel</button>
							<Button variant="primary" type="submit" disabled={invitePending}>
								{invitePending ? 'Sending...' : 'Send Invitation'}
							</Button>
						</div>
					</form>
				</div>
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

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
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}

	h1 {
		margin: 0;
		color: var(--color-foreground);
	}

	.members-section {
		margin-bottom: 2rem;
	}

	.members-section h2 {
		font-size: 1.1rem;
		margin: 0 0 1rem;
		color: var(--color-foreground);
	}

	.email {
		color: var(--color-muted);
	}

	.actions-cell {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.role-select {
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-foreground);
		font-size: 0.85rem;
		cursor: pointer;
	}

	.role-select.full-width {
		width: 100%;
		padding: 0.5rem 0.75rem;
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

	/* ─── Dialog ───────────────────────────────────────────────────────── */

	.dialog-overlay {
		position: fixed;
		inset: 0;
		background: var(--color-overlay);
		z-index: 50;
	}

	.dialog-content {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 51;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 1.5rem;
		width: 90vw;
		max-width: 440px;
	}

	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
	}

	.dialog-header h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-foreground);
	}

	.dialog-close {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-muted);
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
	}

	.dialog-close:hover {
		color: var(--color-foreground);
		background: var(--color-hover);
	}

	.invite-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.dialog-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		justify-content: flex-end;
		margin-top: 0.25rem;
	}

	.cancel-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-muted);
		font-size: 0.9rem;
		padding: 0.4rem 0.75rem;
		border-radius: var(--radius-sm);
	}

	.cancel-btn:hover {
		color: var(--color-foreground);
		background: var(--color-hover);
	}
</style>
