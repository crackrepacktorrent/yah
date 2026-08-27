import { useLocation } from '@solidjs/router';
import { Show, createMemo, type ParentProps } from 'solid-js';
import { requireSession } from '~/platform/auth/session';
import './emails/emails.css';

function routeIsWithin(pathname: string, base: string): boolean {
	return pathname === base || pathname.startsWith(`${base}/`);
}

export default function EmailManagementLayout(props: ParentProps) {
	const location = useLocation();
	const session = createMemo(() => requireSession());
	const canViewTemplates = createMemo(() => session().permissions['template']?.includes('view') ?? false);
	const canViewLists = createMemo(() => session().permissions['list']?.includes('view') ?? false);
	const canViewCampaigns = createMemo(() => session().permissions['campaign']?.includes('view') ?? false);
	const canViewSubscribers = createMemo(() => session().permissions['subscriber']?.includes('view') ?? false);
	const canViewBounces = createMemo(() => session().permissions['bounce']?.includes('view') ?? false);

	return (
		<>
			<Show when={canViewTemplates() || canViewLists() || canViewCampaigns() || canViewSubscribers() || canViewBounces()}>
				<nav class="email-navigation" aria-label="Email management">
					<Show when={canViewCampaigns()}>
						<a href="/emails/campaigns" data-selected={routeIsWithin(location.pathname, '/emails/campaigns') || undefined}>Campaigns</a>
					</Show>
					<Show when={canViewCampaigns()}>
						<a href="/emails/analytics" data-selected={routeIsWithin(location.pathname, '/emails/analytics') || undefined}>Email analytics</a>
					</Show>
					<Show when={canViewTemplates()}>
						<a
							href="/emails"
							data-selected={(location.pathname === '/emails' || routeIsWithin(location.pathname, '/emails/templates')) || undefined}
						>
							Templates
						</a>
					</Show>
					<Show when={canViewLists()}>
						<a href="/emails/lists" data-selected={routeIsWithin(location.pathname, '/emails/lists') || undefined}>Lists</a>
						<a href="/emails/forms" data-selected={routeIsWithin(location.pathname, '/emails/forms') || undefined}>Forms</a>
					</Show>
					<Show when={canViewSubscribers()}>
						<a href="/emails/subscribers" data-selected={routeIsWithin(location.pathname, '/emails/subscribers') || undefined}>Subscribers</a>
					</Show>
					<Show when={canViewBounces()}>
						<a href="/emails/bounces" data-selected={routeIsWithin(location.pathname, '/emails/bounces') || undefined}>Bounces</a>
					</Show>
				</nav>
			</Show>
			{props.children}
		</>
	);
}
