import { createSignal, Show } from 'solid-js';
import { authClient } from '~/lib/auth-client';
import { LOGO_FILL_ORANGE } from '~/lib/constants';
import { FormField, Input, Button, Logo } from '~/components/admin';
import './auth.css';

export default function ForgotPasswordPage() {
	const [email, setEmail] = createSignal('');
	const [loading, setLoading] = createSignal(false);
	const [sent, setSent] = createSignal(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		setLoading(true);

		try {
			await authClient.requestPasswordReset({
				email: email(),
				redirectTo: '/admin/reset-password',
			});
		} catch {
			// Silently ignore — don't reveal whether the email exists
		}

		// Always show success to prevent email enumeration
		setSent(true);
		setLoading(false);
	}

	return (
		<div class="auth-page">
			<div class="auth-container">
				<Logo fill={LOGO_FILL_ORANGE} height={140} />

				<Show
					when={sent()}
					fallback={
						<form class="auth-card" onSubmit={handleSubmit}>
							<h2>Reset your password</h2>
							<p class="auth-subtitle">Enter your email and we'll send you a reset link.</p>

							<FormField label="Email">
								<Input type="email" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} required />
							</FormField>

							<Button type="submit" disabled={loading()} aria-busy={loading()}>
								{loading() ? 'Sending…' : 'Send reset link'}
							</Button>

							<a href="/admin/login" class="auth-link">Back to login</a>
						</form>
					}
				>
					<div class="auth-card">
						<h2>Check your email</h2>
						<p class="auth-muted">
							If an account exists for <strong>{email()}</strong>, we've sent a password reset link.
						</p>
						<a href="/admin/login" class="auth-link">Back to login</a>
					</div>
				</Show>
			</div>
		</div>
	);
}
