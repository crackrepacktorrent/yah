import { Show, createSignal } from 'solid-js';
import { authClient } from '~/platform/auth/client';
import { AuthCard, AuthField, AuthShell } from '~/ui/auth';

export default function ForgotPasswordPage() {
	const [email, setEmail] = createSignal('');
	const [loading, setLoading] = createSignal(false);
	const [sent, setSent] = createSignal(false);

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		setLoading(true);

		try {
			await authClient.requestPasswordReset({ email: email(), redirectTo: '/reset-password' });
		} catch {
			// The response is intentionally identical for every address and failure.
		} finally {
			setSent(true);
			setLoading(false);
		}
	}

	return (
		<AuthShell>
			<Show
				when={sent()}
				fallback={
					<form class="auth-card" onSubmit={handleSubmit}>
						<h1>Reset your password</h1>
						<p class="auth-subtitle">Enter your email and we'll send you a reset link.</p>
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
						<button class="auth-button" type="submit" disabled={loading()} aria-busy={loading() ? 'true' : undefined}>
							{loading() ? 'Sending…' : 'Send reset link'}
						</button>
						<a href="/login" class="auth-link">
							Back to login
						</a>
					</form>
				}
			>
				<AuthCard>
					<h1>Check your email</h1>
					<p class="auth-muted" role="status" aria-live="polite">
						If an account exists for <strong>{email()}</strong>, we've sent a password reset link.
					</p>
					<a href="/login" class="auth-link">
						Back to login
					</a>
				</AuthCard>
			</Show>
		</AuthShell>
	);
}
