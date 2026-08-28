import { can } from '@yah/admin-core/permissions';
import { revalidate, type RouteDefinition, useNavigate } from '@solidjs/router';
import { Errored, Loading, Show, createMemo, type ParentProps } from 'solid-js';
import { authClient } from '~/platform/auth/client';
import { getSession, requireSession } from '~/platform/auth/session';
import { ErrorView } from '~/ui/error-view';
import { toast } from '~/ui/toast';
import './(app).css';

export const route = {
	preload: () => void requireSession(),
} satisfies RouteDefinition;

export default function ProtectedLayout(props: ParentProps) {
	const navigate = useNavigate();
	const session = createMemo(() => requireSession());
	const canViewAnalytics = createMemo(() => can(session(), 'analytics', 'view'));
	const canViewShortlinks = createMemo(() => can(session(), 'shortlink', 'view'));
	const canViewEmailTemplates = createMemo(() => can(session(), 'template', 'view'));
	const canViewMailingLists = createMemo(() => can(session(), 'list', 'view'));
	const canViewCampaigns = createMemo(() => can(session(), 'campaign', 'view'));
	const canViewSubscribers = createMemo(() => can(session(), 'subscriber', 'view'));
	const canViewBounces = createMemo(() => can(session(), 'bounce', 'view'));
	const canViewSettings = createMemo(() => can(session(), 'settings', 'view'));
	const canViewEmailLogs = createMemo(() => can(session(), 'provider', 'manage'));
	const canViewRoles = createMemo(() => can(session(), 'ac', 'read'));
	const canViewMembers = createMemo(
		() =>
			can(session(), 'member', 'create') &&
			can(session(), 'invitation', 'create'),
	);
	const emailHref = createMemo(() => {
		if (canViewEmailTemplates()) return '/emails';
		if (canViewMailingLists()) return '/emails/lists';
		if (canViewCampaigns()) return '/emails/campaigns';
		if (canViewSubscribers()) return '/emails/subscribers';
		if (canViewBounces()) return '/emails/bounces';
		if (canViewEmailLogs()) return '/emails/logs';
		return undefined;
	});

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
							<a href="/">
								Dashboard
							</a>
							<Show when={canViewAnalytics()}>
								<a href="/analytics">
									Analytics
								</a>
							</Show>
							<Show when={canViewShortlinks()}>
								<a href="/shortlinks">
									Shortlinks
								</a>
							</Show>
							<Show when={emailHref()}>
								{(href) => <a href={href()}>Email</a>}
							</Show>
							<Show when={canViewRoles()}>
								<a href="/roles">Roles</a>
							</Show>
							<Show when={canViewMembers()}>
								<a href="/members">Members</a>
							</Show>
							<Show when={canViewSettings()}>
								<a href="/settings/email">Settings</a>
							</Show>
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
