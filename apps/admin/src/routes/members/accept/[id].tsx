import { createAsync, revalidate, useNavigate, useParams, useSearchParams, type RouteDefinition } from '@solidjs/router';
import { createEffect, createMemo, createSignal, ErrorBoundary, Match, Show, Suspense, Switch } from 'solid-js';
import { authClient } from '~/lib/auth-client';
import { LOGO_FILL_ORANGE } from '~/lib/constants';
import { invitationCallbackPath } from '~/lib/invitation-path';
import { Button, FormField, Input, Logo } from '~/components';
import { getSession } from '~/routes/session';
import { acceptInvitation as acceptInvitationOnServer, completeInvitationAccount, getInvitationInfo } from './accept.server';
import { getInvitationStep } from './invitation-state';
import '../../(auth)/auth.css';

export const route: RouteDefinition = {
	preload: ({ params }) => {
		void getInvitationInfo(params['id']!);
		void getSession();
	},
};

function verificationErrorMessage(code: string | undefined): string {
	switch (code?.toUpperCase()) {
		case 'INVALID_TOKEN':
			return 'That secure link is invalid or has already been used. Request a new one below.';
		case 'TOKEN_EXPIRED':
			return 'That secure link has expired. Request a new one below.';
		case 'INVITATION_UNAVAILABLE':
			return 'That secure link can no longer be used. Ask an administrator for a new invitation if you still need access.';
		default:
			return code ? 'That secure link could not be used. Request a new one below.' : '';
	}
}

export default function AcceptInvitationPage() {
	const params = useParams<{ id: string }>();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams<{ error?: string }>();
	const invitation = createAsync(() => getInvitationInfo(params['id']));
	const session = createAsync(() => getSession());

	const [name, setName] = createSignal('');
	const [password, setPassword] = createSignal('');
	const [confirmPassword, setConfirmPassword] = createSignal('');
	const [error, setError] = createSignal('');
	const [activationWarning, setActivationWarning] = createSignal('');
	const [accessMessage, setAccessMessage] = createSignal('');
	const [dismissedCallbackError, setDismissedCallbackError] = createSignal(false);
	const [loading, setLoading] = createSignal(false);
	const [accepted, setAccepted] = createSignal(false);
	const [accountCompleted, setAccountCompleted] = createSignal(false);
	const callbackError = createMemo(() => (dismissedCallbackError() ? '' : verificationErrorMessage(searchParams.error)));
	const step = createMemo(() =>
		getInvitationStep({
			invitation: invitation(),
			sessionEmail: session()?.user.email,
			sessionEmailVerified: session()?.user.emailVerified ?? false,
			sessionHasPassword: accountCompleted() || (invitation()?.sessionHasPassword ?? false),
			accepted: accepted(),
		})
	);

	let previousStep: ReturnType<typeof step> | undefined;
	createEffect(() => {
		const currentStep = step();
		if (previousStep && previousStep !== currentStep) {
			queueMicrotask(() => document.querySelector<HTMLElement>('[data-invitation-heading]')?.focus());
		}
		previousStep = currentStep;
	});

	createEffect(() => {
		const sessionName = session()?.user.name?.trim();
		if (sessionName && !name()) setName(sessionName);
	});

	async function acceptInvitation() {
		const result = await acceptInvitationOnServer(params['id']);

		setAccepted(true);
		const organizationId = result.organizationId;
		if (organizationId) {
			try {
				const orgResult = await authClient.organization.setActive({ organizationId });
				if (orgResult.error) throw new Error('Organization activation failed.');
			} catch {
				setActivationWarning(
					'Your invitation was accepted, but the organization could not be activated. Sign in again if the dashboard does not load.'
				);
			}
		}

		try {
			await revalidate(['session', 'require-session', 'guest', 'invitation-info']);
		} catch {
			// Membership is durable; a fresh navigation will reload session state.
		}
	}

	async function handleAccept() {
		setError('');
		setLoading(true);
		try {
			await acceptInvitation();
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : 'Failed to accept invitation.');
		} finally {
			setLoading(false);
		}
	}

	async function handleRequestAccess() {
		setError('');
		setAccessMessage('');
		setDismissedCallbackError(true);
		setLoading(true);
		try {
			const callbackURL = invitationCallbackPath(params['id']);
			const result = await authClient.signIn.magicLink({
				email: 'invitation-request@invalid.example',
				callbackURL,
				newUserCallbackURL: callbackURL,
				errorCallbackURL: callbackURL,
				metadata: { invitationId: params['id'] },
			});
			if (result.error) throw new Error(result.error.message ?? 'The secure access link could not be sent.');
			navigate(callbackURL, { replace: true });
			setAccessMessage('A secure, one-time access link has been sent to the invited email address.');
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : 'The secure access link could not be sent.');
		} finally {
			setLoading(false);
		}
	}

	async function handleCompleteAccount(event: SubmitEvent) {
		event.preventDefault();
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
			await completeInvitationAccount({ invitationId: params['id'], name: name(), password: password() });
			setAccountCompleted(true);
			setPassword('');
			setConfirmPassword('');
			try {
				await revalidate(['session', 'require-session', 'guest', 'invitation-info']);
			} catch {
				// The durable password change succeeded; local state advances the UI.
			}
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : 'The account could not be completed.');
		} finally {
			setLoading(false);
		}
	}

	async function handleSignOut() {
		setError('');
		setLoading(true);
		try {
			const result = await authClient.signOut();
			if (result.error) throw new Error(result.error.message ?? 'Failed to sign out.');
			setPassword('');
			setConfirmPassword('');
			setAccepted(false);
			navigate('/login');
			try {
				await revalidate(['session', 'require-session', 'guest', 'invitation-info']);
			} catch {
				// Sign-out is durable; navigation must not be reported as a failure.
			}
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : 'Failed to sign out.');
		} finally {
			setLoading(false);
		}
	}

	async function handleRetryInvitation(reset: () => void) {
		try {
			await revalidate(['session', 'invitation-info']);
		} catch {
			// Resetting the boundary will render the same recoverable state again.
		} finally {
			reset();
		}
	}

	return (
		<div class="auth-page">
			<div class="auth-container">
				<Logo fill={LOGO_FILL_ORANGE} height={100} />

				<ErrorBoundary
					fallback={(_caughtError, reset) => (
						<div class="auth-card" style={{ 'text-align': 'center' }}>
							<h1 data-invitation-heading tabindex="-1">
								Invitation unavailable
							</h1>
							<p class="auth-error" role="alert">
								The invitation could not be loaded. Check your connection and try again.
							</p>
							<Button onClick={() => handleRetryInvitation(reset)}>Try again</Button>
						</div>
					)}
				>
					<Suspense
						fallback={
							<div class="auth-card">
								<p class="auth-muted" role="status">
									Loading…
								</p>
							</div>
						}
					>
						<Switch>
							<Match when={step() === 'accepted'}>
								<div class="auth-card" style={{ 'text-align': 'center' }}>
									<h1 data-invitation-heading tabindex="-1">
										Welcome!
									</h1>
									<p class="auth-muted">You've been added to {invitation()?.organizationName ?? 'the organization'}.</p>
									<Show when={activationWarning()}>
										<p class="auth-error" role="alert">
											{activationWarning()}
										</p>
									</Show>
									<Show when={error()}>
										<p class="auth-error" role="alert">
											{error()}
										</p>
									</Show>
									<Button onClick={() => navigate('/')}>Go to Dashboard</Button>
									<Show when={activationWarning()}>
										<Button variant="secondary" onClick={handleSignOut} disabled={loading()} aria-busy={loading()}>
											{loading() ? 'Signing out…' : 'Sign out and try again'}
										</Button>
									</Show>
								</div>
							</Match>

							<Match when={['not-found', 'canceled', 'already-accepted', 'invalid', 'expired'].includes(step())}>
								<div class="auth-card" style={{ 'text-align': 'center' }}>
									<h1 data-invitation-heading tabindex="-1">
										Invitation unavailable
									</h1>
									<p class="auth-muted">
										{step() === 'canceled'
											? 'This invitation has been cancelled.'
											: step() === 'already-accepted'
												? 'This invitation has already been accepted. If your access was removed, ask an administrator for a new invitation.'
												: step() === 'expired'
													? 'This invitation has expired. Ask an administrator to send a new one.'
													: 'This invitation is invalid or no longer available.'}
									</p>
									<Button variant="secondary" onClick={() => navigate('/login')}>
										Go to Login
									</Button>
								</div>
							</Match>

							<Match when={step() === 'accept'}>
								<div class="auth-card" style={{ 'text-align': 'center' }}>
									<h1 data-invitation-heading tabindex="-1">
										Accept invitation
									</h1>
									<p class="auth-muted">
										You're signed in as <strong>{session()!.user.email}</strong>. Accept the invitation to join{' '}
										<strong>{invitation()!.organizationName}</strong> as {invitation()!.role}.
									</p>
									<Show when={error()}>
										<p class="auth-error" role="alert">
											{error()}
										</p>
									</Show>
									<Button onClick={handleAccept} disabled={loading()} aria-busy={loading()}>
										{loading() ? 'Accepting…' : 'Accept Invitation'}
									</Button>
								</div>
							</Match>

							<Match when={step() === 'request-access'}>
								<div class="auth-card" style={{ 'text-align': 'center' }}>
									<h1 data-invitation-heading tabindex="-1">
										Verify your invitation
									</h1>
									<p class="auth-muted">
										We'll send a secure, one-time link to the invited email address. It will return you here after proving mailbox
										ownership.
									</p>
									<Show when={callbackError()}>
										<p class="auth-error" role="alert">
											{callbackError()}
										</p>
									</Show>
									<Show when={accessMessage()}>
										<p role="status">{accessMessage()}</p>
									</Show>
									<Show when={error()}>
										<p class="auth-error" role="alert">
											{error()}
										</p>
									</Show>
									<Button onClick={handleRequestAccess} disabled={loading()} aria-busy={loading()}>
										{loading() ? 'Sending…' : 'Email secure access link'}
									</Button>
								</div>
							</Match>

							<Match when={step() === 'setup-account'}>
								<form class="auth-card" onSubmit={handleCompleteAccount}>
									<h1 data-invitation-heading tabindex="-1">
										Complete your account
									</h1>
									<p class="auth-muted">
										Mailbox ownership is verified. Set your password before joining <strong>{invitation()!.organizationName}</strong>.
									</p>
									<FormField label="Email">
										<Input type="email" name="email" autocomplete="username" value={session()!.user.email} readOnly />
									</FormField>
									<FormField label="Name" required>
										<Input
											name="name"
											autocomplete="name"
											value={name()}
											onInput={(event) => setName(event.currentTarget.value)}
											maxLength={100}
											required
										/>
									</FormField>
									<FormField label="Password" required>
										<Input
											type="password"
											name="password"
											autocomplete="new-password"
											value={password()}
											onInput={(event) => setPassword(event.currentTarget.value)}
											minLength={8}
											maxLength={128}
											required
										/>
									</FormField>
									<FormField label="Confirm password" required>
										<Input
											type="password"
											name="confirm-password"
											autocomplete="new-password"
											value={confirmPassword()}
											onInput={(event) => setConfirmPassword(event.currentTarget.value)}
											minLength={8}
											maxLength={128}
											required
										/>
									</FormField>
									<Show when={error()}>
										<p class="auth-error" role="alert">
											{error()}
										</p>
									</Show>
									<Button type="submit" disabled={loading()} class="login-btn" aria-busy={loading()}>
										{loading() ? 'Saving…' : 'Set password and continue'}
									</Button>
								</form>
							</Match>

							<Match when={step() === 'wrong-account'}>
								<div class="auth-card" style={{ 'text-align': 'center' }}>
									<h1 data-invitation-heading tabindex="-1">
										Wrong account
									</h1>
									<p class="auth-muted">
										You're signed in as <strong>{session()!.user.email}</strong>, which is not the invited account.
									</p>
									<Show when={error()}>
										<p class="auth-error" role="alert">
											{error()}
										</p>
									</Show>
									<Button onClick={handleSignOut} disabled={loading()} aria-busy={loading()}>
										{loading() ? 'Signing out…' : 'Sign Out'}
									</Button>
								</div>
							</Match>
						</Switch>
					</Suspense>
				</ErrorBoundary>
			</div>
		</div>
	);
}
