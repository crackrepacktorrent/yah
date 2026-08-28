import { useLocation } from '@solidjs/router';
import type { ParentProps } from 'solid-js';
import { SectionNavigation } from '~/ui/section-navigation';
import './email.css';

export default function EmailSettingsLayout(props: ParentProps) {
	const location = useLocation();
	return (
		<>
			<SectionNavigation
				label="Email settings"
				items={[
					{ href: '/settings/email/general', label: 'General', selected: location.pathname === '/settings/email/general' },
					{ href: '/settings/email', label: 'SMTP delivery', selected: location.pathname === '/settings/email' },
					{ href: '/settings/email/performance', label: 'Performance', selected: location.pathname === '/settings/email/performance' },
					{ href: '/settings/email/bounces', label: 'Bounces', selected: location.pathname === '/settings/email/bounces' },
					{ href: '/settings/email/privacy', label: 'Privacy', selected: location.pathname === '/settings/email/privacy' },
					{ href: '/settings/email/provider', label: 'Provider', selected: location.pathname === '/settings/email/provider' },
				]}
			/>
			{props.children}
		</>
	);
}
