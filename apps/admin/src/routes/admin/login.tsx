import { createSignal, Show } from 'solid-js';
import { revalidate, useNavigate } from '@solidjs/router';
import { authClient } from '~/lib/auth-client';
import { ORG_SLUG, LOGO_FILL_ORANGE } from '~/lib/constants';
import { FormField, Input, Button, Logo } from '~/components/admin';
import './auth.css';

export default function LoginPage() {
	const navigate = useNavigate();
	const [email, setEmail] = createSignal('');
	const [password, setPassword] = createSignal('');
	const [error, setError] = createSignal('');
	const [loading, setLoading] = createSignal(false);

	async function handleLogin(e: SubmitEvent) {
		e.preventDefault();
		setError('');
		setLoading(true);

		const result = await authClient.signIn.email({
			email: email(),
			password: password(),
		});

		if (result.error) {
			setError(result.error.message ?? 'Login failed');
			setLoading(false);
			return;
		}

		const orgResult = await authClient.organization.setActive({
			organizationSlug: ORG_SLUG,
		});

		if (orgResult.error) {
			setError('Signed in, but failed to load organization. Contact an admin.');
			setLoading(false);
			return;
		}

		await revalidate(['session', 'require-session', 'guest']);
		navigate('/admin');
	}

	return (
		<div class="auth-page">
			<div class="auth-container">
				<Logo fill={LOGO_FILL_ORANGE} height={140} />

				<form class="auth-card" onSubmit={handleLogin}>
					<FormField label="Email">
						<Input type="email" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} required />
					</FormField>

					<FormField label="Password">
						<Input type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} required />
					</FormField>

					<Show when={error()}>
						<p class="auth-error">{error()}</p>
					</Show>

					<Button type="submit" disabled={loading()} aria-busy={loading()} class="login-btn">
						{loading() ? 'Signing in…' : 'Sign in'}
					</Button>

					<a href="/admin/forgot-password" class="auth-link">Forgot password?</a>
				</form>
			</div>
		</div>
	);
}
