import { revalidate, type RouteDefinition, useLocation, useNavigate } from '@solidjs/router';
import { Errored, For, Loading, createMemo, type ParentProps } from 'solid-js';
import { authClient } from '~/platform/auth/client';
import { getSession, requireSession } from '~/platform/auth/session';
import { ErrorView } from '~/ui/error-view';
import { primaryNavigation } from '~/ui/navigation';
import { NavigationLink } from '~/ui/section-navigation';
import { toast } from '~/ui/toast';
import './(app).css';

export const route = {
	preload: () => void requireSession(),
} satisfies RouteDefinition;

export default function ProtectedLayout(props: ParentProps) {
	const navigate = useNavigate();
	const location = useLocation();
	const session = createMemo(() => requireSession());
	const navigation = createMemo(() => primaryNavigation(session(), location.pathname));

	async function handleLogout(): Promise<void> {
		try {
			const result = await authClient.signOut();
			if (result.error) {
				toast.error('Sign out failed. Please try again.');
				return;
			}
			revalidate([getSession.key, requireSession.key]);
			navigate('/login', { replace: true });
		} catch {
			toast.error('Sign out failed. Check your connection and try again.');
		}
	}

	return (
		<Errored fallback={(error, reset) => <ErrorView error={error()} reset={reset} onRetry={() => revalidate()} />}>
			<Loading
				fallback={
					<div class="admin-loading" role="status">
						<span class="admin-spinner" aria-hidden="true" />
						<span class="visually-hidden">Loading admin…</span>
					</div>
				}
			>
				<div class="admin-layout-v2">
					<header class="admin-header-v2">
						<a class="admin-brand-v2" href="/" aria-label="YAH Admin dashboard">
							<img src="/logo.svg" alt="" height="48" />
						</a>
						<nav aria-label="Primary navigation">
							<For each={navigation()}>
								{(item) => <NavigationLink item={item} />}
							</For>
						</nav>
						<div class="admin-account-v2">
							<span class="admin-account-email-v2">{session().user.email}</span>
							<button type="button" onClick={() => void handleLogout()}>
								Sign out
							</button>
						</div>
					</header>
					<main class="admin-content-v2">
						<Errored fallback={(error, reset) => <ErrorView error={error()} reset={reset} onRetry={() => revalidate()} />}>
							<Loading
								fallback={
									<div class="admin-page-loading" role="status">
										<span class="admin-spinner" aria-hidden="true" />
										<span class="visually-hidden">Loading page…</span>
									</div>
								}
							>
								{props.children}
							</Loading>
						</Errored>
					</main>
				</div>
			</Loading>
		</Errored>
	);
}
