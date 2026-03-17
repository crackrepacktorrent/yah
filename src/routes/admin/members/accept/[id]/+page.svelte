<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { Button, Logo } from '$lib/components/admin';

	let status = $state<'loading' | 'success' | 'error'>('loading');
	let errorMessage = $state('');

	const invitationId = $derived($page.params.id!);

	$effect(() => {
		if (invitationId) acceptInvitation(invitationId);
	});

	async function acceptInvitation(id: string) {
		try {
			await authClient.organization.acceptInvitation({
				invitationId: id,
			});
			status = 'success';
		} catch (err: any) {
			status = 'error';
			errorMessage = err?.message || 'Failed to accept invitation.';
		}
	}
</script>

<div class="accept-page">
	<div class="accept-container">
		<Logo fill="#ff6f00" height={100} />

		{#if status === 'loading'}
			<p>Accepting invitation...</p>
		{:else if status === 'success'}
			<h2>Welcome!</h2>
			<p>You've been added to Youth Alliance for Housing.</p>
			<Button variant="primary" onclick={() => goto('/admin')}>Go to Dashboard</Button>
		{:else}
			<h2>Something went wrong</h2>
			<p class="error">{errorMessage}</p>
			<Button variant="secondary" onclick={() => goto('/admin/login')}>Go to Login</Button>
		{/if}
	</div>
</div>

<style>
	.accept-page {
		min-height: 100vh;
		background: var(--color-page-bg);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.accept-container {
		text-align: center;
		max-width: 400px;
		padding: 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	h2 {
		margin: 0;
		color: var(--color-foreground);
	}

	p {
		color: var(--color-muted);
		margin: 0;
	}

	.error {
		color: var(--color-destructive);
	}
</style>
