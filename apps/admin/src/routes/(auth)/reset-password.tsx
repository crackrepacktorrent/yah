import { createSignal, Show } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { toast } from '~/lib/toast';
import { authClient } from '~/lib/auth-client';
import { LOGO_FILL_ORANGE } from '~/lib/constants';
import { FormField, Input, Button, Logo } from '~/components';
import './auth.css';

export default function ResetPasswordPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams<{ token?: string }>();
	const [newPassword, setNewPassword] = createSignal('');
	const [confirmPassword, setConfirmPassword] = createSignal('');
	const [error, setError] = createSignal('');
	const [loading, setLoading] = createSignal(false);

	const token = () => searchParams.token ?? '';

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		setError('');

		if (newPassword() !== confirmPassword()) {
			setError('Passwords do not match');
			return;
		}

		if (newPassword().length < 8) {
			setError('Password must be at least 8 characters');
			return;
		}

		setLoading(true);

		try {
			const result = await authClient.resetPassword({
				newPassword: newPassword(),
				token: token(),
			});

			if (result.error) {
				setError(result.error.message ?? 'Failed to reset password');
				return;
			}

			toast.success('Password reset successfully. Please sign in.');
			navigate('/login');
		} catch {
			setError('Failed to reset password. The link may have expired.');
		} finally {
			setLoading(false);
		}
	}

	return (
		<div class="auth-page">
			<div class="auth-container">
				<Logo fill={LOGO_FILL_ORANGE} height={140} />

				<Show
					when={token()}
					fallback={
						<div class="auth-card">
							<h2>Invalid reset link</h2>
							<p class="auth-muted">This password reset link is invalid or has expired.</p>
							<a href="/forgot-password" class="auth-link">Request a new one</a>
						</div>
					}
				>
					<form class="auth-card" onSubmit={handleSubmit}>
						<h2>Set new password</h2>

						<FormField label="New password">
							<Input
								type="password"
								value={newPassword()}
								onInput={(e) => setNewPassword(e.currentTarget.value)}
								required
								minLength={8}
							/>
						</FormField>

						<FormField label="Confirm password">
							<Input
								type="password"
								value={confirmPassword()}
								onInput={(e) => setConfirmPassword(e.currentTarget.value)}
								required
								minLength={8}
							/>
						</FormField>

						<Show when={error()}>
							<p class="auth-error">{error()}</p>
						</Show>

						<Button type="submit" disabled={loading()} aria-busy={loading()}>
							{loading() ? 'Resetting…' : 'Reset password'}
						</Button>

						<a href="/login" class="auth-link">Back to login</a>
					</form>
				</Show>
			</div>
		</div>
	);
}
