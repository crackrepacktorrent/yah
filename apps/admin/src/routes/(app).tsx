import { createAsync, revalidate, useNavigate, type RouteDefinition } from '@solidjs/router';
import { createMemo, ErrorBoundary, Suspense, type JSX } from 'solid-js';
import { Sidebar, Spinner, type NavSection } from '~/components';
import { authClient } from '~/lib/auth-client';
import { canAccessFeature, type Feature } from '~/lib/feature-policy';
import { requireSession } from '~/routes/session';
import './(app).css';

export const route: RouteDefinition = {
	preload: () => {
		void requireSession();
	},
};

type PolicyNavItem = {
	href: string;
	label: string;
	icon: string;
	policy?: Feature;
	children?: Array<{ href: string; label: string; icon?: string; policy: Feature }>;
};

const NAV_SECTIONS: Array<{ label: string; items: PolicyNavItem[] }> = [
	{
		label: 'Home',
		items: [
			{ href: '/', label: 'Dashboard', icon: 'dashboard', policy: 'dashboard' },
			{ href: '/shortlinks', label: 'Shortlinks', icon: 'link', policy: 'shortlinks' },
			{ href: '/analytics', label: 'Analytics', icon: 'chart', policy: 'analytics' },
		],
	},
	{
		label: 'Email',
		items: [
			{
				href: '/emails/campaigns',
				label: 'Campaigns',
				icon: 'megaphone',
				children: [
					{
						href: '/emails/campaigns',
						label: 'All Campaigns',
						icon: 'megaphone',
						policy: 'campaigns',
					},
					{ href: '/emails', label: 'Templates', icon: 'mail', policy: 'templates' },
					{
						href: '/emails/analytics',
						label: 'Analytics',
						icon: 'pie-chart',
						policy: 'campaignAnalytics',
					},
				],
			},
			{
				href: '/emails/subscribers',
				label: 'Subscribers',
				icon: 'contact',
				children: [
					{
						href: '/emails/subscribers',
						label: 'All Subscribers',
						icon: 'contact',
						policy: 'subscribers',
					},
					{ href: '/emails/bounces', label: 'Bounces', icon: 'alert-circle', policy: 'bounces' },
				],
			},
			{
				href: '/emails/lists',
				label: 'Lists',
				icon: 'list-checks',
				children: [
					{ href: '/emails/lists', label: 'All Lists', icon: 'list-checks', policy: 'lists' },
					{ href: '/emails/forms', label: 'Forms', icon: 'clipboard-list', policy: 'forms' },
				],
			},
			{ href: '/emails/logs', label: 'Logs', icon: 'file-text', policy: 'emailLogs' },
		],
	},
	{
		label: 'Organization',
		items: [
			{ href: '/members', label: 'Members', icon: 'users', policy: 'members' },
			{ href: '/roles', label: 'Roles', icon: 'shield', policy: 'roles' },
		],
	},
	{
		label: 'Settings',
		items: [{ href: '/settings/email', label: 'Email', icon: 'settings', policy: 'settings' }],
	},
];

function visibleNavSections(session: Parameters<typeof canAccessFeature>[0]): NavSection[] {
	return NAV_SECTIONS.map((section) => ({
		label: section.label,
		items: section.items.flatMap((item) => {
			if (item.children) {
				const children = item.children
					.filter((child) => canAccessFeature(session, child.policy))
					.map(({ policy: _policy, ...child }) => child);
				return children.length > 0 ? [{ href: item.href, label: item.label, icon: item.icon, children }] : [];
			}

			if (!item.policy || !canAccessFeature(session, item.policy)) return [];
			return [{ href: item.href, label: item.label, icon: item.icon }];
		}),
	})).filter((section) => section.items.length > 0);
}

function ErrorView(props: { error: unknown; reset: () => void }) {
	const message = () => (props.error instanceof Error ? props.error.message : 'An unexpected error occurred.');

	return (
		<div class="error-boundary">
			<h2>Something went wrong</h2>
			<p>{message()}</p>
			<div class="error-actions">
				<button class="error-btn" onClick={() => props.reset()}>
					Try again
				</button>
				<a href="/" class="error-link">
					Back to Dashboard
				</a>
			</div>
		</div>
	);
}

export default function AppLayout(props: { children: JSX.Element }) {
	const navigate = useNavigate();
	const session = createAsync(() => requireSession());

	const navSections = createMemo(() => {
		return visibleNavSections(session());
	});

	async function handleLogout() {
		await authClient.signOut();
		navigate('/login');
		void revalidate(['require-session', 'session']);
	}

	return (
		<div class="admin-layout">
			<Sidebar sections={navSections()} user={session()?.user ?? null} onlogout={handleLogout} />
			<main>
				<ErrorBoundary
					fallback={(err, reset) => {
						console.error('[ErrorBoundary]', err);
						return <ErrorView error={err} reset={reset} />;
					}}
				>
					<Suspense fallback={<Spinner size={80} centered />}>{props.children}</Suspense>
				</ErrorBoundary>
			</main>
		</div>
	);
}
