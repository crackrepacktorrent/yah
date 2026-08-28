import { revalidate, useNavigate, useSearchParams, type RouteProps } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Errored, Loading, Match, Show, Switch, createEffect, createMemo, createSignal } from 'solid-js';
import { invitationCallbackPath } from '@yah/admin-core/invitation-path';
import { getInvitationStep, type InvitationStep } from '@yah/admin-core/invitation-state';
import {
	acceptInvitation as acceptInvitationOnServer,
	completeInvitationAccount,
	getInvitationInfo,
} from '~/features/invitations/server';
import { authClient } from '~/platform/auth/client';
import { getSession, requireSession } from '~/platform/auth/session';
import { AuthCard, AuthError, AuthField, AuthShell } from '~/ui/auth';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/members/accept/:id', {
	preload: ({ params }) => {
		void getInvitationInfo(params.id);
		void getSession();
	},
});

const unavailableSteps = new Set<InvitationStep>(['not-found', 'canceled', 'already-accepted', 'invalid', 'expired']);

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

function unavailableMessage(step: InvitationStep): string {
	switch (step) {
		case 'canceled':
			return 'This invitation has been cancelled.';
		case 'already-accepted':
			return 'This invitation has already been accepted. If your access was removed, ask an administrator for a new invitation.';
		case 'expired':
			return 'This invitation has expired. Ask an administrator to send a new one.';
		default:
			return 'This invitation is invalid or no longer available.';
	}
}

export default function AcceptInvitationPage(props: RouteProps<typeof route>) {
	const invitationId = createMemo(() => props.params.id);
	return <Show when={invitationId()} keyed>{(resolved) => <AcceptInvitationRoute invitationId={resolved} />}</Show>;
}

function AcceptInvitationRoute(props: { invitationId: string }) {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const invitationId = () => props.invitationId;
	const invitationPath = () => invitationCallbackPath(invitationId());
	const invitation = createMemo(() => getInvitationInfo(invitationId()));
	const session = createMemo(() => getSession());

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
	const callbackError = createMemo(() => {
		const code = typeof searchParams['error'] === 'string' ? searchParams['error'] : undefined;
		return dismissedCallbackError() ? '' : verificationErrorMessage(code);
	});
	const step = createMemo(() =>
		getInvitationStep({
			invitation: invitation(),
			sessionEmail: session()?.user.email,
			sessionEmailVerified: session()?.user.emailVerified ?? false,
			sessionHasPassword: accountCompleted() || (invitation()?.sessionHasPassword ?? false),
			accepted: accepted(),
		}),
	);

	let previousStep: InvitationStep | undefined;
	createEffect(
		() => step(),
		(currentStep) => {
			if (previousStep && previousStep !== currentStep) {
				queueMicrotask(() => document.querySelector<HTMLElement>('[data-invitation-heading]')?.focus());
			}
			previousStep = currentStep;
		},
	);

	createEffect(
		() => session()?.user.name?.trim(),
		(sessionName) => {
			if (sessionName && !name()) setName(sessionName);
		},
	);

	async function acceptInvitation(): Promise<void> {
		const result = await acceptInvitationOnServer(invitationId());
		setAccepted(true);

		try {
			const organization = await authClient.organization.setActive({ organizationId: result.organizationId });
			if (organization.error) throw new Error('Organization activation failed.');
		} catch {
			setActivationWarning(
				'Your invitation was accepted, but the organization could not be activated. Sign in again if the dashboard does not load.',
			);
		}

		revalidate([getSession.key, requireSession.key, getInvitationInfo.keyFor(invitationId())]);
	}

	async function handleAccept(): Promise<void> {
		setError('');
		setLoading(true);
		try {
			await acceptInvitation();
		} catch (caughtError) {
			setError(visibleError(caughtError, 'Failed to accept the invitation.'));
		} finally {
			setLoading(false);
		}
	}

	async function handleRequestAccess(): Promise<void> {
		setError('');
		setAccessMessage('');
		setDismissedCallbackError(true);
		setLoading(true);

		try {
			const callbackURL = invitationPath();
			const result = await authClient.signIn.magicLink({
				email: 'invitation-request@invalid.example',
				callbackURL,
				newUserCallbackURL: callbackURL,
				errorCallbackURL: callbackURL,
				metadata: { invitationId: invitationId() },
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

	async function handleCompleteAccount(event: SubmitEvent): Promise<void> {
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
			await completeInvitationAccount({ invitationId: invitationId(), name: name(), password: password() });
			setAccountCompleted(true);
			setPassword('');
			setConfirmPassword('');
			revalidate([getSession.key, requireSession.key, getInvitationInfo.keyFor(invitationId())]);
		} catch (caughtError) {
			setError(visibleError(caughtError, 'The account could not be completed.'));
		} finally {
			setLoading(false);
		}
	}

	async function signOut(stayOnInvitation: boolean): Promise<void> {
		setError('');
		setLoading(true);
		try {
			const result = await authClient.signOut();
			if (result.error) throw new Error(result.error.message ?? 'Failed to sign out.');
			setPassword('');
			setConfirmPassword('');
			setAccepted(false);
			revalidate([getSession.key, requireSession.key, getInvitationInfo.keyFor(invitationId())]);
			navigate(stayOnInvitation ? invitationPath() : '/login', { replace: true });
		} catch {
			setError('Failed to sign out. Check your connection and try again.');
		} finally {
			setLoading(false);
		}
	}

	function retryInvitation(reset: () => void): void {
		revalidate([getSession.key, getInvitationInfo.keyFor(invitationId())], true);
		reset();
	}

	return (
		<AuthShell logoHeight={100}>
			<Errored
				fallback={(_caughtError, reset) => (
					<AuthCard centered>
						<h1 data-invitation-heading tabindex="-1">
							Invitation unavailable
						</h1>
						<AuthError>The invitation could not be loaded. Check your connection and try again.</AuthError>
						<button class="auth-button" type="button" onClick={() => retryInvitation(reset)}>
							Try again
						</button>
					</AuthCard>
				)}
			>
				<Loading
					fallback={
						<AuthCard>
							<p class="auth-muted" role="status">
								Loading…
							</p>
						</AuthCard>
					}
				>
					<Switch>
						<Match when={step() === 'accepted'}>
							<AuthCard centered>
								<h1 data-invitation-heading tabindex="-1">
									Welcome!
								</h1>
								<p class="auth-muted">You've been added to {invitation()?.organizationName ?? 'the organization'}.</p>
								<Show when={activationWarning()}>{(message) => <AuthError>{message()}</AuthError>}</Show>
								<Show when={error()}>{(message) => <AuthError>{message()}</AuthError>}</Show>
								<button class="auth-button" type="button" onClick={() => navigate('/')}>
									Go to Dashboard
								</button>
								<Show when={activationWarning()}>
									<button
										class="auth-button auth-button--secondary"
										type="button"
										onClick={() => void signOut(false)}
										disabled={loading()}
										aria-busy={loading() ? 'true' : undefined}
									>
										{loading() ? 'Signing out…' : 'Sign out and try again'}
									</button>
								</Show>
							</AuthCard>
						</Match>

						<Match when={unavailableSteps.has(step())}>
							<AuthCard centered>
								<h1 data-invitation-heading tabindex="-1">
									Invitation unavailable
								</h1>
								<p class="auth-muted">{unavailableMessage(step())}</p>
								<a class="auth-button auth-button--secondary" href="/login">
									Go to Login
								</a>
							</AuthCard>
						</Match>

						<Match when={step() === 'accept'}>
							<AuthCard centered>
								<h1 data-invitation-heading tabindex="-1">
									Accept invitation
								</h1>
								<p class="auth-muted">
									You're signed in as <strong>{session()?.user.email}</strong>. Accept the invitation to join{' '}
									<strong>{invitation()?.organizationName}</strong> as {invitation()?.role}.
								</p>
								<Show when={error()}>{(message) => <AuthError>{message()}</AuthError>}</Show>
								<button
									class="auth-button"
									type="button"
									onClick={() => void handleAccept()}
									disabled={loading()}
									aria-busy={loading() ? 'true' : undefined}
								>
									{loading() ? 'Accepting…' : 'Accept Invitation'}
								</button>
							</AuthCard>
						</Match>

						<Match when={step() === 'request-access'}>
							<AuthCard centered>
								<h1 data-invitation-heading tabindex="-1">
									Verify your invitation
								</h1>
								<p class="auth-muted">
									We'll send a secure, one-time link to the invited email address. It will return you here after proving mailbox ownership.
								</p>
								<Show when={callbackError()}>{(message) => <AuthError>{message()}</AuthError>}</Show>
								<Show when={accessMessage()}>{(message) => <p role="status">{message()}</p>}</Show>
								<Show when={error()}>{(message) => <AuthError>{message()}</AuthError>}</Show>
								<button
									class="auth-button"
									type="button"
									onClick={() => void handleRequestAccess()}
									disabled={loading()}
									aria-busy={loading() ? 'true' : undefined}
								>
									{loading() ? 'Sending…' : 'Email secure access link'}
								</button>
							</AuthCard>
						</Match>

						<Match when={step() === 'setup-account'}>
							<form class="auth-card" onSubmit={handleCompleteAccount}>
								<h1 data-invitation-heading tabindex="-1">
									Complete your account
								</h1>
								<p class="auth-muted">
									Mailbox ownership is verified. Set your password before joining{' '}
									<strong>{invitation()?.organizationName}</strong>.
								</p>
								<AuthField label="Email">
									<input class="auth-input" type="email" name="email" autocomplete="username" value={session()?.user.email ?? ''} readonly />
								</AuthField>
								<AuthField label="Name" required>
									<input
										class="auth-input"
										name="name"
										autocomplete="name"
										value={name()}
										onInput={(event) => setName(event.currentTarget.value)}
										maxlength={100}
										required
									/>
								</AuthField>
								<AuthField label="Password" required>
									<input
										class="auth-input"
										type="password"
										name="password"
										autocomplete="new-password"
										value={password()}
										onInput={(event) => setPassword(event.currentTarget.value)}
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
									{loading() ? 'Saving…' : 'Set password and continue'}
								</button>
							</form>
						</Match>

						<Match when={step() === 'wrong-account'}>
							<AuthCard centered>
								<h1 data-invitation-heading tabindex="-1">
									Wrong account
								</h1>
								<p class="auth-muted">
									You're signed in as <strong>{session()?.user.email}</strong>, which is not the invited account.
								</p>
								<Show when={error()}>{(message) => <AuthError>{message()}</AuthError>}</Show>
								<button
									class="auth-button"
									type="button"
									onClick={() => void signOut(true)}
									disabled={loading()}
									aria-busy={loading() ? 'true' : undefined}
								>
									{loading() ? 'Signing out…' : 'Sign out and continue'}
								</button>
							</AuthCard>
						</Match>
					</Switch>
				</Loading>
			</Errored>
		</AuthShell>
	);
}
