import { createAsync, revalidate, useNavigate, useParams, type RouteDefinition } from '@solidjs/router';
import { createSignal, Match, Show, Suspense, Switch } from 'solid-js';
import { authClient } from '~/lib/auth-client';
import { ORG_SLUG, LOGO_FILL_ORANGE } from '~/lib/constants';
import { Button, FormField, Input, Logo } from '~/components';
import { getSession } from '~/routes/admin/session';
import { getInvitationInfo } from './accept.server';
import '../../(auth)/auth.css';

export const route: RouteDefinition = {
	preload: ({ params }) => {
		void getInvitationInfo(params['id']!);
		void getSession();
	},
};

export default function AcceptInvitationPage() {
	const params = useParams<{ id: string }>();
	const navigate = useNavigate();
	const invitation = createAsync(() => getInvitationInfo(params['id']));
	const session = createAsync(() => getSession());

	const [mode, setMode] = createSignal<'signup' | 'login'>('signup');
	const [name, setName] = createSignal('');
	const [password, setPassword] = createSignal('');
	const [confirmPassword, setConfirmPassword] = createSignal('');
	const [error, setError] = createSignal('');
	const [loading, setLoading] = createSignal(false);
	const [accepted, setAccepted] = createSignal(false);
	const [autoAcceptError, setAutoAcceptError] = createSignal('');

	async function acceptAndRedirect() {
		const result = await authClient.organization.acceptInvitation({ invitationId: params['id'] });
		if (result.error) throw new Error(result.error.message ?? 'Failed to accept invitation.');
		await authClient.organization.setActive({ organizationSlug: ORG_SLUG });
		await revalidate(['session', 'require-session', 'guest']);
		setAccepted(true);
	}

	async function handleSignup(e: SubmitEvent) {
		e.preventDefault();
		setError('');

		if (password() !== confirmPassword()) {
			setError('Passwords do not match.');
			return;
		}
		if (password().length < 8) {
			setError('Password must be at least 8 characters.');
			return;
		}

		setLoading(true);
		try {
			const result = await authClient.signUp.email({
				email: invitation()!.email,
				password: password(),
				name: name(),
			});
			if (result.error) {
				setError(result.error.message ?? 'Signup failed.');
				return;
			}
			await acceptAndRedirect();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Something went wrong.');
		} finally {
			setLoading(false);
		}
	}

	async function handleLogin(e: SubmitEvent) {
		e.preventDefault();
		setError('');
		setLoading(true);
		try {
			const result = await authClient.signIn.email({
				email: invitation()!.email,
				password: password(),
			});
			if (result.error) {
				setError(result.error.message ?? 'Login failed.');
				return;
			}
			await acceptAndRedirect();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Something went wrong.');
		} finally {
			setLoading(false);
		}
	}

	async function handleAutoAccept() {
		try {
			await acceptAndRedirect();
		} catch (err) {
			setAutoAcceptError(err instanceof Error ? err.message : 'Failed to accept invitation.');
		}
	}

	async function handleSignOut() {
		await authClient.signOut();
		await revalidate(['session', 'require-session', 'guest']);
	}

	function AutoAcceptCard() {
		handleAutoAccept();
		return (
			<div class="auth-card" style={{ 'text-align': 'center' }}>
				<Show when={!autoAcceptError()} fallback={<>
					<h2>Something went wrong</h2>
					<p class="auth-error">{autoAcceptError()}</p>
					<Button variant="secondary" onClick={() => navigate('/admin')}>Go to Dashboard</Button>
				</>}>
					<p class="auth-muted">Accepting invitation…</p>
				</Show>
			</div>
		);
	}

	return (
		<div class="auth-page">
			<div class="auth-container">
				<Logo fill={LOGO_FILL_ORANGE} height={100} />

				<Suspense fallback={<div class="auth-card"><p class="auth-muted">Loading…</p></div>}>
					<Switch>
						{/* Accepted */}
						<Match when={accepted()}>
							<div class="auth-card" style={{ 'text-align': 'center' }}>
								<h2>Welcome!</h2>
								<p class="auth-muted">You've been added to {invitation()?.organizationName}.</p>
								<Button onClick={() => navigate('/admin')}>Go to Dashboard</Button>
							</div>
						</Match>

						{/* Invalid / not found / cancelled / already accepted */}
						<Match when={!invitation() || invitation()!.status !== 'pending'}>
							<div class="auth-card" style={{ 'text-align': 'center' }}>
								<h2>Invalid Invitation</h2>
								<p class="auth-muted">
									{!invitation()
										? 'This invitation was not found.'
										: invitation()!.status === 'canceled'
											? 'This invitation has been cancelled.'
											: invitation()!.status === 'accepted'
												? 'This invitation has already been accepted.'
												: 'This invitation is no longer valid.'}
								</p>
								<Button variant="secondary" onClick={() => navigate('/admin/login')}>
									Go to Login
								</Button>
							</div>
						</Match>

						{/* Logged in as the invited user → auto-accept */}
						<Match when={session() && session()!.user.email === invitation()!.email}>
							<AutoAcceptCard />
						</Match>

						{/* Logged in as different user */}
						<Match when={session()}>
							<div class="auth-card" style={{ 'text-align': 'center' }}>
								<h2>Wrong Account</h2>
								<p class="auth-muted">
									You're signed in as <strong>{session()!.user.email}</strong>, but this invitation
									was sent to <strong>{invitation()!.email}</strong>.
								</p>
								<Button onClick={handleSignOut}>Sign Out</Button>
							</div>
						</Match>

						{/* Not logged in — signup */}
						<Match when={mode() === 'signup'}>
							<form class="auth-card" onSubmit={handleSignup}>
								<h2>Create your account</h2>
								<p class="auth-muted">
									You've been invited to join <strong>{invitation()!.organizationName}</strong> as {invitation()!.role}.
								</p>

								<FormField label="Email">
									<Input type="email" value={invitation()!.email} readonly />
								</FormField>
								<FormField label="Name" required>
									<Input
										value={name()}
										onInput={(e) => setName(e.currentTarget.value)}
										placeholder="Your name"
										required
									/>
								</FormField>
								<FormField label="Password" required>
									<Input
										type="password"
										value={password()}
										onInput={(e) => setPassword(e.currentTarget.value)}
										placeholder="Min. 8 characters"
										required
									/>
								</FormField>
								<FormField label="Confirm Password" required>
									<Input
										type="password"
										value={confirmPassword()}
										onInput={(e) => setConfirmPassword(e.currentTarget.value)}
										required
									/>
								</FormField>

								<Show when={error()}>
									<p class="auth-error">{error()}</p>
								</Show>

								<Button type="submit" disabled={loading()} class="login-btn">
									{loading() ? 'Creating account…' : 'Create Account'}
								</Button>

								<button type="button" class="auth-link" onClick={() => { setError(''); setPassword(''); setMode('login'); }}>
									Already have an account? Sign in
								</button>
							</form>
						</Match>

						{/* Not logged in — login */}
						<Match when={mode() === 'login'}>
							<form class="auth-card" onSubmit={handleLogin}>
								<h2>Sign in to accept</h2>
								<p class="auth-muted">
									Sign in to join <strong>{invitation()!.organizationName}</strong>.
								</p>

								<FormField label="Email">
									<Input type="email" value={invitation()!.email} readonly />
								</FormField>
								<FormField label="Password" required>
									<Input
										type="password"
										value={password()}
										onInput={(e) => setPassword(e.currentTarget.value)}
										required
									/>
								</FormField>

								<Show when={error()}>
									<p class="auth-error">{error()}</p>
								</Show>

								<Button type="submit" disabled={loading()} class="login-btn">
									{loading() ? 'Signing in…' : 'Sign in & Accept'}
								</Button>

								<button type="button" class="auth-link" onClick={() => { setError(''); setPassword(''); setConfirmPassword(''); setMode('signup'); }}>
									Don't have an account? Create one
								</button>
								<a href="/admin/forgot-password" class="auth-link">Forgot password?</a>
							</form>
						</Match>
					</Switch>
				</Suspense>
			</div>
		</div>
	);
}
