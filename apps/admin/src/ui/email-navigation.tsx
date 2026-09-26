import { useLocation } from '@solidjs/router';
import { Show, createMemo } from 'solid-js';
import { requireSession } from '~/platform/auth/session';
import { emailNavigation } from './navigation';
import { SectionNavigation } from './section-navigation';

export function EmailNavigation() {
	const location = useLocation();
	const session = createMemo(() => requireSession());
	const items = createMemo(() => emailNavigation(session(), location.pathname));
	return <Show when={items().length > 0}><SectionNavigation label="Email management" items={items()} /></Show>;
}
