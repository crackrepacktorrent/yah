import { createAsync, revalidate, useNavigate, type RouteDefinition } from '@solidjs/router';
import { createMemo, ErrorBoundary, Suspense, type JSX } from 'solid-js';
import { Sidebar, Spinner } from '~/components';
import { authClient } from '~/lib/auth-client';
import { can } from '~/lib/can';
import { requireSession } from '~/routes/admin/session';

export const route: RouteDefinition = {
	preload: () => { void requireSession(); },
};

const STATIC_NAV_SECTIONS = [
	{
		label: 'Home',
		items: [
			{ href: '/admin', label: 'Dashboard', icon: 'dashboard' },
			{ href: '/admin/shortlinks', label: 'Shortlinks', icon: 'link' },
			{ href: '/admin/analytics', label: 'Analytics', icon: 'chart' },
			{ href: '/admin/media', label: 'Media', icon: 'image' },
		],
	},
	{
		label: 'Email',
		items: [
			{
				href: '/admin/emails/campaigns',
				label: 'Campaigns',
				icon: 'megaphone',
				children: [
					{ href: '/admin/emails/campaigns', label: 'All Campaigns', icon: 'megaphone' },
					{ href: '/admin/emails', label: 'Templates', icon: 'mail' },
					{ href: '/admin/emails/analytics', label: 'Analytics', icon: 'pie-chart' },
				],
			},
			{
				href: '/admin/emails/subscribers',
				label: 'Subscribers',
				icon: 'contact',
				children: [
					{ href: '/admin/emails/subscribers', label: 'All Subscribers', icon: 'contact' },
					{ href: '/admin/emails/subscribers/import', label: 'Import', icon: 'upload' },
					{ href: '/admin/emails/bounces', label: 'Bounces', icon: 'alert-circle' },
				],
			},
			{
				href: '/admin/emails/lists',
				label: 'Lists',
				icon: 'list-checks',
				children: [
					{ href: '/admin/emails/lists', label: 'All Lists', icon: 'list-checks' },
					{ href: '/admin/emails/forms', label: 'Forms', icon: 'clipboard-list' },
				],
			},
		],
	},
];

function ErrorView(props: { error: unknown; reset: () => void }) {
	const message = () =>
		props.error instanceof Error ? props.error.message : 'An unexpected error occurred.';

	return (
		<div class="error-boundary">
			<h2>Something went wrong</h2>
			<p>{message()}</p>
			<div class="error-actions">
				<button class="error-btn" onClick={() => props.reset()}>Try again</button>
				<a href="/admin" class="error-link">Back to Dashboard</a>
			</div>
		</div>
	);
}

export default function AppLayout(props: { children: JSX.Element }) {
	const navigate = useNavigate();
	const session = createAsync(() => requireSession());

	const navSections = createMemo(() => {
		const s = session();
		const sections = [...STATIC_NAV_SECTIONS];

		if (can(s, 'member', 'create')) {
			sections.push({
				label: 'Organization',
				items: [
					{ href: '/admin/members', label: 'Members', icon: 'users' },
					{ href: '/admin/roles', label: 'Roles', icon: 'shield' },
				],
			});
		}

		if (can(s, 'settings', 'view')) {
			sections.push({
				label: 'Settings',
				items: [
					{ href: '/admin/settings/email', label: 'Email', icon: 'settings' },
				],
			});
		}

		return sections;
	});

	async function handleLogout() {
		await authClient.signOut();
		navigate('/admin/login');
		void revalidate(['require-session', 'session']);
	}

	return (
		<div class="admin-layout">
			<Sidebar
				sections={navSections()}
				user={session()?.user ?? null}
				onlogout={handleLogout}
			/>
			<main>
				<ErrorBoundary fallback={(err, reset) => { console.error('[ErrorBoundary]', err); return <ErrorView error={err} reset={reset} />; }}>
					<Suspense fallback={<Spinner size={48} centered />}>
						{props.children}
					</Suspense>
				</ErrorBoundary>
			</main>
		</div>
	);
}
