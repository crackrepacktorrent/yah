import { createResource, Match, Switch } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { authClient } from '~/lib/auth-client';
import { LOGO_FILL_ORANGE } from '~/lib/constants';
import { Button, Logo } from '~/components/admin';
import '../../auth.css';

export default function AcceptInvitationPage() {
	const params = useParams<{ id: string }>();
	const navigate = useNavigate();

	const [result] = createResource(
		() => params['id'],
		(id) => authClient.organization.acceptInvitation({ invitationId: id }),
	);

	return (
		<div class="auth-page">
			<div class="auth-container">
				<Logo fill={LOGO_FILL_ORANGE} height={100} />

				<div class="auth-card" style={{ 'text-align': 'center' }}>
					<Switch>
						<Match when={result.loading}>
							<p class="auth-muted">Accepting invitation…</p>
						</Match>
						<Match when={result.error || result()?.error}>
							<h2>Something went wrong</h2>
							<p class="auth-error">
								{result.error instanceof Error
									? result.error.message
									: (result()?.error?.message ?? 'Failed to accept invitation.')}
							</p>
							<Button variant="secondary" onClick={() => navigate('/admin/login')}>
								Go to Login
							</Button>
						</Match>
						<Match when={result()?.data}>
							<h2>Welcome!</h2>
							<p class="auth-muted">You've been added to the organization.</p>
							<Button onClick={() => navigate('/admin')}>Go to Dashboard</Button>
						</Match>
					</Switch>
				</div>
			</div>
		</div>
	);
}
