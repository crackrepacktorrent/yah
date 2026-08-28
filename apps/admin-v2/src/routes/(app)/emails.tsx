import { can } from '@yah/admin-core/permissions';
import { useLocation } from '@solidjs/router';
import { Show, createMemo, type ParentProps } from 'solid-js';
import { requireSession } from '~/platform/auth/session';
import { SectionNavigation, type SectionNavigationItem } from '~/ui/section-navigation';
import './emails/emails.css';

function routeIsWithin(pathname: string, base: string): boolean {
	return pathname === base || pathname.startsWith(`${base}/`);
}

export default function EmailManagementLayout(props: ParentProps) {
	const location = useLocation();
	const session = createMemo(() => requireSession());
	const canViewTemplates = createMemo(() => can(session(), 'template', 'view'));
	const canViewLists = createMemo(() => can(session(), 'list', 'view'));
	const canViewCampaigns = createMemo(() => can(session(), 'campaign', 'view'));
	const canViewSubscribers = createMemo(() => can(session(), 'subscriber', 'view'));
	const canViewBounces = createMemo(() => can(session(), 'bounce', 'view'));
	const canViewLogs = createMemo(() => can(session(), 'provider', 'manage'));
	const items = createMemo<SectionNavigationItem[]>(() => {
		const pathname = location.pathname;
		const links: SectionNavigationItem[] = [];
		if (canViewCampaigns()) {
			links.push(
				{ href: '/emails/campaigns', label: 'Campaigns', selected: routeIsWithin(pathname, '/emails/campaigns') },
				{ href: '/emails/analytics', label: 'Email analytics', selected: routeIsWithin(pathname, '/emails/analytics') },
			);
		}
		if (canViewTemplates()) links.push({ href: '/emails', label: 'Templates', selected: pathname === '/emails' || routeIsWithin(pathname, '/emails/templates') });
		if (canViewLists()) {
			links.push(
				{ href: '/emails/lists', label: 'Lists', selected: routeIsWithin(pathname, '/emails/lists') },
				{ href: '/emails/forms', label: 'Forms', selected: routeIsWithin(pathname, '/emails/forms') },
			);
		}
		if (canViewSubscribers()) links.push({ href: '/emails/subscribers', label: 'Subscribers', selected: routeIsWithin(pathname, '/emails/subscribers') });
		if (canViewBounces()) links.push({ href: '/emails/bounces', label: 'Bounces', selected: routeIsWithin(pathname, '/emails/bounces') });
		if (canViewLogs()) links.push({ href: '/emails/logs', label: 'Logs', selected: routeIsWithin(pathname, '/emails/logs') });
		return links;
	});

	return (
		<>
			<Show when={items().length > 0}><SectionNavigation label="Email management" items={items()} /></Show>
			{props.children}
		</>
	);
}
