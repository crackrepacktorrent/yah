import { revalidate, useNavigate } from '@solidjs/router';
import { Show, createSignal } from 'solid-js';
import { ORG_SLUG } from '@yah/admin-core/constants';
import { authClient } from '~/platform/auth/client';
import { getSession, requireSession } from '~/platform/auth/session';
import { AuthError, AuthField, AuthShell } from '~/ui/auth';

export default function LoginPage() {
	const navigate = useNavigate();
	const [email, setEmail] = createSignal('');
	const [password, setPassword] = createSignal('');
	const [error, setError] = createSignal('');
	const [loading, setLoading] = createSignal(false);

	async function handleLogin(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		setError('');
		setLoading(true);

		try {
			const result = await authClient.signIn.email({ email: email(), password: password() });
			if (result.error) {
				setError(result.error.message ?? 'Login failed.');
				return;
			}

			const organization = await authClient.organization.setActive({ organizationSlug: ORG_SLUG });
			if (organization.error) {
				setError('Signed in, but this account could not access the organization. Contact an administrator.');
				return;
			}

			revalidate([getSession.key, requireSession.key]);
			navigate('/', { replace: true });
		} catch {
			setError('Login failed. Check your connection and try again.');
		} finally {
			setLoading(false);
		}
	}

	return (
		<AuthShell>
			<form class="auth-card" onSubmit={handleLogin}>
				<h1>Sign in</h1>
				<AuthField label="Email" required>
					<input
						class="auth-input"
						type="email"
						name="email"
						autocomplete="username"
						value={email()}
						onInput={(event) => setEmail(event.currentTarget.value)}
						required
					/>
				</AuthField>

				<AuthField label="Password" required>
					<input
						class="auth-input"
						type="password"
						name="password"
						autocomplete="current-password"
						value={password()}
						onInput={(event) => setPassword(event.currentTarget.value)}
						required
					/>
				</AuthField>

				<Show when={error()}>{(message) => <AuthError>{message()}</AuthError>}</Show>

				<button class="auth-button" type="submit" disabled={loading()} aria-busy={loading() ? 'true' : undefined}>
					{loading() ? 'Signing in…' : 'Sign in'}
				</button>
				<a href="/forgot-password" class="auth-link">
					Forgot password?
				</a>
			</form>
		</AuthShell>
	);
}
