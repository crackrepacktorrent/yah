<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { FormField, Input, Button } from '$lib/components/admin';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleLogin() {
		error = '';
		loading = true;

		const result = await authClient.signIn.email({
			email,
			password,
		});

		if (result.error) {
			error = result.error.message ?? 'Login failed';
			loading = false;
			return;
		}

		goto('/admin');
	}
</script>

<div class="login-page">
<div class="login-container">
	<img src="/yah-logo.png" alt="YAH" class="login-logo" />

	<form onsubmit={handleLogin}>
		<FormField label="Email">
			<Input type="email" bind:value={email} required />
		</FormField>

		<FormField label="Password">
			<Input type="password" bind:value={password} required />
		</FormField>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<Button type="submit" disabled={loading} class="login-btn">
			{loading ? 'Signing in...' : 'Sign in'}
		</Button>
	</form>
</div>
</div>

<style>
	.login-page {
		min-height: 100vh;
		background: #f5f5f7;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.login-container {
		width: 100%;
		max-width: 400px;
		padding: 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.login-logo {
		height: 140px;
		width: auto;
		margin-bottom: 2rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		background: #fff;
		padding: 2rem;
		border-radius: var(--radius-lg);
		box-shadow: var(--admin-shadow-lg);
		width: 100%;
	}

	.error {
		color: var(--destructive);
		margin: 0;
		font-size: 0.9rem;
	}
</style>
