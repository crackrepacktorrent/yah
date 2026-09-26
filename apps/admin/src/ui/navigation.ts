import { can, type PermissionSession } from '@yah/admin-core/permissions';
import type { SectionNavigationItem } from './section-navigation';

type NavigationSession = PermissionSession | null | undefined;

function routeIsWithin(pathname: string, base: string): boolean {
	return pathname === base || pathname.startsWith(`${base}/`);
}

function link(pathname: string, href: string, label: string): SectionNavigationItem {
	return { href, label, selected: routeIsWithin(pathname, href) };
}

export function emailNavigation(session: NavigationSession, pathname: string): SectionNavigationItem[] {
	const items: SectionNavigationItem[] = [];
	if (can(session, 'campaign', 'view')) {
		items.push(link(pathname, '/emails/campaigns', 'Campaigns'), link(pathname, '/emails/analytics', 'Email analytics'));
	}
	if (can(session, 'template', 'view')) {
		items.push({
			href: '/emails',
			label: 'Templates',
			selected: pathname === '/emails' || pathname === '/emails/' || routeIsWithin(pathname, '/emails/templates'),
		});
	}
	if (can(session, 'list', 'view')) {
		items.push(link(pathname, '/emails/lists', 'Lists'), link(pathname, '/emails/forms', 'Forms'));
	}
	if (can(session, 'subscriber', 'view')) items.push(link(pathname, '/emails/subscribers', 'Subscribers'));
	if (can(session, 'bounce', 'view')) items.push(link(pathname, '/emails/bounces', 'Bounces'));
	if (can(session, 'provider', 'manage')) items.push(link(pathname, '/emails/logs', 'Logs'));
	if (can(session, 'settings', 'view')) {
		items.push({ href: '/settings/email/general', label: 'Settings', selected: routeIsWithin(pathname, '/settings/email') });
	}
	return items;
}

export function emailSettingsNavigation(session: NavigationSession, pathname: string): SectionNavigationItem[] {
	if (!can(session, 'settings', 'view')) return [];
	return [
		link(pathname, '/settings/email/general', 'General'),
		{ href: '/settings/email', label: 'SMTP delivery', selected: pathname === '/settings/email' || pathname === '/settings/email/' },
		link(pathname, '/settings/email/performance', 'Performance'),
		link(pathname, '/settings/email/bounces', 'Bounces'),
		link(pathname, '/settings/email/privacy', 'Privacy'),
		link(pathname, '/settings/email/provider', 'Provider'),
	];
}

export function primaryNavigation(session: NavigationSession, pathname: string): SectionNavigationItem[] {
	const items = [link(pathname, '/', 'Dashboard')];
	if (can(session, 'analytics', 'view')) items.push(link(pathname, '/analytics', 'Analytics'));
	if (can(session, 'shortlink', 'view')) items.push(link(pathname, '/shortlinks', 'Shortlinks'));
	const emailItems = emailNavigation(session, pathname);
	// Keep Templates as the default landing page; otherwise use the first accessible section.
	const emailHref = emailItems.find(({ href }) => href === '/emails')?.href ?? emailItems[0]?.href;
	if (emailHref) {
		items.push({
			href: emailHref,
			label: 'Email',
			selected: routeIsWithin(pathname, '/emails') || routeIsWithin(pathname, '/settings/email'),
		});
	}
	if (can(session, 'ac', 'read')) items.push(link(pathname, '/roles', 'Roles'));
	if (can(session, 'member', 'create') && can(session, 'invitation', 'create')) items.push(link(pathname, '/members', 'Members'));
	return items;
}
