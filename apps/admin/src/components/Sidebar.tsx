import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useLocation } from '@solidjs/router';
import { Collapsible } from '@kobalte/core/collapsible';
import { Dialog } from '@kobalte/core/dialog';
import { Tooltip } from '@kobalte/core/tooltip';
import { Logo } from './Logo';
import {
	AlertCircle, BarChart3, ChevronRight, ClipboardList, Contact,
	Image, LayoutDashboard, Link, ListChecks, LogOut, Mail,
	Megaphone, Menu, PieChart, Settings, Shield, Upload, Users, X,
} from 'lucide-solid';
import './Sidebar.css';

const icons: Record<string, Component<{ size?: number; class?: string }>> = {
	dashboard: LayoutDashboard,
	link: Link,
	chart: BarChart3,
	mail: Mail,
	users: Users,
	contact: Contact,
	'list-checks': ListChecks,
	'alert-circle': AlertCircle,
	shield: Shield,
	megaphone: Megaphone,
	image: Image,
	'pie-chart': PieChart,
	'clipboard-list': ClipboardList,
	settings: Settings,
	upload: Upload,
};

export type NavItem = {
	href: string;
	label: string;
	icon: string;
	children?: { href: string; label: string; icon?: string }[];
};

export type NavSection = { label: string; items: NavItem[] };

type SidebarProps = {
	sections: NavSection[];
	user: { name?: string | null; email?: string | null } | null;
	onlogout: () => void;
};

type NavItemElProps = {
	item: NavItem;
	isActive: (href: string) => boolean;
	hasActiveChild: (item: NavItem) => boolean;
	isOpen: (href: string) => boolean;
	toggleOpen: (href: string, value: boolean) => void;
	onClose: () => void;
};

const NavItemEl: Component<NavItemElProps> = (props) => {
	return (
		<Show
			when={props.item.children?.length}
			fallback={
				<a
					href={props.item.href}
					class={`nav-item${props.isActive(props.item.href) ? ' active' : ''}`}
					onClick={props.onClose}
				>
					<Show when={icons[props.item.icon]}>
						<Dynamic component={icons[props.item.icon]} size={18} />
					</Show>
					<span class="nav-item-label">{props.item.label}</span>
				</a>
			}
		>
			<Collapsible open={props.isOpen(props.item.href)} onOpenChange={(v) => props.toggleOpen(props.item.href, v)}>
				<Collapsible.Trigger
					as="button"
					class={`nav-item nav-collapsible-trigger${props.hasActiveChild(props.item) ? ' active' : ''}`}
				>
					<Show when={icons[props.item.icon]}>
						<Dynamic component={icons[props.item.icon]} size={18} />
					</Show>
					<span class="nav-item-label">{props.item.label}</span>
					<ChevronRight size={14} class="nav-chevron" />
				</Collapsible.Trigger>
				<Collapsible.Content class="nav-sub">
					<For each={props.item.children}>
						{(child) => (
							<a
								href={child.href}
								class={`nav-sub-item${props.isActive(child.href) ? ' active' : ''}`}
								onClick={props.onClose}
							>
								<Show when={child.icon && icons[child.icon]}>
									<Dynamic component={icons[child.icon!]} size={14} />
								</Show>
								<span>{child.label}</span>
							</a>
						)}
					</For>
				</Collapsible.Content>
			</Collapsible>
		</Show>
	);
};

type SidebarContentProps = SidebarProps & {
	isActive: (href: string) => boolean;
	hasActiveChild: (item: NavItem) => boolean;
	isOpen: (href: string) => boolean;
	toggleOpen: (href: string, value: boolean) => void;
	onClose: () => void;
};

const SidebarContent: Component<SidebarContentProps> = (props) => (
	<>
		<div class="sidebar-header">
			<a href="/" class="brand">
				<Logo fill="var(--brand-magenta-light)" height={72} />
			</a>
		</div>

		<nav class="sidebar-nav">
			<For each={props.sections}>
				{(section) => (
					<div class="nav-section">
						<span class="nav-section-label">{section.label}</span>
						<For each={section.items}>
							{(item) => (
								<NavItemEl
									item={item}
									isActive={props.isActive}
									hasActiveChild={props.hasActiveChild}
									isOpen={props.isOpen}
									toggleOpen={props.toggleOpen}
									onClose={props.onClose}
								/>
							)}
						</For>
					</div>
				)}
			</For>
		</nav>

		<div class="sidebar-footer">
			<div class="user-info">
				<div class="user-avatar">
					{props.user?.name?.charAt(0) ?? props.user?.email?.charAt(0) ?? '?'}
				</div>
				<div class="user-details">
					<span class="user-name">{props.user?.name ?? 'Admin'}</span>
					<span class="user-email">{props.user?.email}</span>
				</div>
			</div>
			<Tooltip openDelay={300}>
				<Tooltip.Trigger as="button" class="logout-btn" onClick={props.onlogout} aria-label="Sign out">
					<LogOut size={18} />
				</Tooltip.Trigger>
				<Tooltip.Portal>
					<Tooltip.Content class="nav-tooltip">
						Sign out
					</Tooltip.Content>
				</Tooltip.Portal>
			</Tooltip>
		</div>
	</>
);

export const Sidebar: Component<SidebarProps> = (props) => {
	const location = useLocation();
	const [mobileOpen, setMobileOpen] = createSignal(false);
	const [collapsibleOpen, setCollapsibleOpen] = createSignal<Record<string, boolean>>({});

	function isActive(href: string) {
		if (href === '/') return location.pathname === '/';
		return location.pathname === href;
	}

	function hasActiveChild(item: NavItem) {
		return item.children?.some((c) => location.pathname === c.href) ?? false;
	}

	function isOpen(href: string) {
		const explicit = collapsibleOpen()[href];
		if (explicit !== undefined) return explicit;
		const item = props.sections.flatMap((s) => s.items).find((i) => i.href === href);
		return item ? hasActiveChild(item) : false;
	}

	function toggleOpen(href: string, value: boolean) {
		setCollapsibleOpen((prev) => ({ ...prev, [href]: value }));
	}

	return (
		<>
			{/* Desktop sidebar */}
			<aside class="sidebar desktop-only">
				<SidebarContent
					sections={props.sections}
					user={props.user}
					onlogout={props.onlogout}
					isActive={isActive}
					hasActiveChild={hasActiveChild}
					isOpen={isOpen}
					toggleOpen={toggleOpen}
					onClose={() => setMobileOpen(false)}
				/>
			</aside>

			{/* Mobile header + drawer */}
			<header class="mobile-header mobile-only">
				<Dialog open={mobileOpen()} onOpenChange={setMobileOpen}>
					<Dialog.Trigger as="button" class="menu-toggle" aria-label="Open menu">
						<Menu size={20} />
					</Dialog.Trigger>
					<Dialog.Portal>
						<Dialog.Overlay class="drawer-overlay" />
						<Dialog.Content as="aside" class="sidebar drawer">
							<Dialog.CloseButton as="button" class="drawer-close">
								<X size={18} />
							</Dialog.CloseButton>
							<SidebarContent
								sections={props.sections}
								user={props.user}
								onlogout={props.onlogout}
								isActive={isActive}
								hasActiveChild={hasActiveChild}
								isOpen={isOpen}
								toggleOpen={toggleOpen}
								onClose={() => setMobileOpen(false)}
							/>
						</Dialog.Content>
					</Dialog.Portal>
				</Dialog>
			</header>
		</>
	);
};
