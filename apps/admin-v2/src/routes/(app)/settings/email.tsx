import { useLocation } from '@solidjs/router';
import type { ParentProps } from 'solid-js';
import './email.css';

export default function EmailSettingsLayout(props: ParentProps) {
	const location = useLocation();
	return (
		<>
			<nav class="settings-navigation" aria-label="Email settings">
				<a href="/settings/email/general" data-selected={location.pathname === '/settings/email/general' || undefined}>General</a>
				<a href="/settings/email" data-selected={location.pathname === '/settings/email' || undefined}>SMTP delivery</a>
				<a href="/settings/email/performance" data-selected={location.pathname === '/settings/email/performance' || undefined}>Performance</a>
				<a href="/settings/email/bounces" data-selected={location.pathname === '/settings/email/bounces' || undefined}>Bounces</a>
				<a href="/settings/email/privacy" data-selected={location.pathname === '/settings/email/privacy' || undefined}>Privacy</a>
				<a href="/settings/email/provider" data-selected={location.pathname === '/settings/email/provider' || undefined}>Provider</a>
			</nav>
			{props.children}
		</>
	);
}
