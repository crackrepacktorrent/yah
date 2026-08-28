import { useNavigate, useSearchParams } from '@solidjs/router';
import { Show, createSignal } from 'solid-js';
import { authClient } from '~/platform/auth/client';
import { AuthCard, AuthError, AuthField, AuthShell } from '~/ui/auth';
import { toast } from '~/ui/toast';

export default function ResetPasswordPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const [newPassword, setNewPassword] = createSignal('');
	const [confirmPassword, setConfirmPassword] = createSignal('');
	const [error, setError] = createSignal('');
	const [loading, setLoading] = createSignal(false);
	const token = () => (typeof searchParams['token'] === 'string' ? searchParams['token'] : '');

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		setError('');

		if (newPassword() !== confirmPassword()) {
			setError('Passwords do not match.');
			return;
		}
		if (newPassword().length < 8) {
			setError('Password must be at least 8 characters.');
			return;
		}

		setLoading(true);
		try {
			const result = await authClient.resetPassword({ newPassword: newPassword(), token: token() });
			if (result.error) {
				setError(result.error.message ?? 'Failed to reset password.');
				return;
			}

			toast.success('Password reset successfully. Please sign in.');
			navigate('/login', { replace: true });
		} catch {
			setError('Failed to reset password. The link may have expired.');
		} finally {
			setLoading(false);
		}
	}

	return (
		<AuthShell>
			<Show
				when={token()}
				fallback={
					<AuthCard>
						<h1>Invalid reset link</h1>
						<p class="auth-muted">This password reset link is invalid or has expired.</p>
						<a href="/forgot-password" class="auth-link">
							Request a new one
						</a>
					</AuthCard>
				}
			>
				<form class="auth-card" onSubmit={handleSubmit}>
					<h1>Set new password</h1>
					<AuthField label="New password" required>
						<input
							class="auth-input"
							type="password"
							name="new-password"
							autocomplete="new-password"
							value={newPassword()}
							onInput={(event) => setNewPassword(event.currentTarget.value)}
							minlength={8}
							maxlength={128}
							required
						/>
					</AuthField>
					<AuthField label="Confirm password" required>
						<input
							class="auth-input"
							type="password"
							name="confirm-password"
							autocomplete="new-password"
							value={confirmPassword()}
							onInput={(event) => setConfirmPassword(event.currentTarget.value)}
							minlength={8}
							maxlength={128}
							required
						/>
					</AuthField>
					<Show when={error()}>{(message) => <AuthError>{message()}</AuthError>}</Show>
					<button class="auth-button" type="submit" disabled={loading()} aria-busy={loading() ? 'true' : undefined}>
						{loading() ? 'Resetting…' : 'Reset password'}
					</button>
					<a href="/login" class="auth-link">
						Back to login
					</a>
				</form>
			</Show>
		</AuthShell>
	);
}
