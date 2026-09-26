import { useLocation } from '@solidjs/router';
import { Show, createMemo, type ParentProps } from 'solid-js';
import { requireSession } from '~/platform/auth/session';
import { EmailNavigation } from '~/ui/email-navigation';
import { emailSettingsNavigation } from '~/ui/navigation';
import { SectionNavigation } from '~/ui/section-navigation';
import './email.css';

export default function EmailSettingsLayout(props: ParentProps) {
	const location = useLocation();
	const session = createMemo(() => requireSession());
	const items = createMemo(() => emailSettingsNavigation(session(), location.pathname));
	return (
		<>
			<EmailNavigation />
			<Show when={items().length > 0}><SectionNavigation label="Email settings" items={items()} /></Show>
			{props.children}
		</>
	);
}
