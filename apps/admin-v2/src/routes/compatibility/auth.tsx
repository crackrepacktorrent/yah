import { Show, createMemo, createSignal } from 'solid-js';
import { authClient } from '~/platform/auth/client';
import './compatibility.css';

type SessionState = { kind: 'idle' | 'pending' | 'signed-out' } | { kind: 'error'; message: string } | { kind: 'signed-in'; email: string };

export default function AuthCompatibility() {
	const [email, setEmail] = createSignal('solid2-compatibility@example.test');
	const [session, setSession] = createSignal<SessionState>({ kind: 'idle' });
	const sessionMessage = createMemo(() => {
		const current = session();
		switch (current.kind) {
			case 'idle':
				return undefined;
			case 'pending':
				return 'Checking session…';
			case 'signed-out':
				return 'Signed out';
			case 'signed-in':
				return `Signed in as ${current.email}`;
			case 'error':
				return current.message;
		}
	});

	async function loadSession(): Promise<void> {
		setSession({ kind: 'pending' });
		try {
			const result = await authClient.getSession();
			if (result.error) {
				setSession({ kind: 'error', message: 'Session lookup failed.' });
				return;
			}
			setSession(result.data ? { kind: 'signed-in', email: result.data.user.email } : { kind: 'signed-out' });
		} catch {
			setSession({ kind: 'error', message: 'Session lookup failed.' });
		}
	}

	async function createSession(): Promise<void> {
		setSession({ kind: 'pending' });
		try {
			const result = await authClient.signUp.email({
				email: email(),
				name: 'Solid 2 Compatibility',
				password: 'compatibility-password-123',
			});
			if (result.error) {
				setSession({ kind: 'error', message: 'Account creation failed.' });
				return;
			}
			await loadSession();
		} catch {
			setSession({ kind: 'error', message: 'Account creation failed.' });
		}
	}

	async function clearSession(): Promise<void> {
		setSession({ kind: 'pending' });
		try {
			const result = await authClient.signOut();
			if (result.error) {
				setSession({ kind: 'error', message: 'Sign out failed.' });
				return;
			}
			await loadSession();
		} catch {
			setSession({ kind: 'error', message: 'Sign out failed.' });
		}
	}

	return (
		<main class="shell">
			<p class="eyebrow">Dependency gallery</p>
			<h1>Framework-neutral Better Auth client</h1>
			<p>
				<a href="/compatibility">Back to the platform smoke</a>
			</p>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void createSession();
				}}
			>
				<label for="compatibility-email">Compatibility email</label>
				<input id="compatibility-email" type="email" value={email()} required onInput={(event) => setEmail(event.currentTarget.value)} />
				<div class="gallery-actions">
					<button type="submit" disabled={session().kind === 'pending'}>
						Create session
					</button>
				</div>
			</form>
			<div class="gallery-actions">
				<button type="button" disabled={session().kind === 'pending'} onClick={() => void loadSession()}>
					Load session
				</button>
				<button type="button" disabled={session().kind === 'pending'} onClick={() => void clearSession()}>
					Sign out
				</button>
			</div>
			<Show when={sessionMessage()}>{(message) => <p role={session().kind === 'error' ? 'alert' : 'status'}>{message()}</p>}</Show>
		</main>
	);
}
