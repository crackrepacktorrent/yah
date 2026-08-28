import { can } from '@yah/admin-core/permissions';
import { revalidate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo, createSignal } from 'solid-js';
import type { SaveEmailPrivacyPolicyCommand } from '~/features/email-settings/contracts';
import { EmailPrivacyForm } from '~/features/email-settings/privacy-form';
import { getEmailPrivacyPolicy, saveEmailPrivacyPolicy } from '~/features/email-settings/server';
import { requireSession } from '~/platform/auth/session';
import { PageHeader } from '~/ui/page-header';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/settings/email/privacy', {
	preload: () => void getEmailPrivacyPolicy(),
});

export default function EmailPrivacyPage() {
	const policy = createMemo(() => getEmailPrivacyPolicy());
	const session = createMemo(() => requireSession());
	const canEdit = createMemo(() => can(session(), 'settings', 'edit'));
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');

	async function save(command: SaveEmailPrivacyPolicyCommand): Promise<void> {
		setError('');
		setPending(true);
		try {
			const result = await saveEmailPrivacyPolicy(command);
			toast.success(result.needsRestart
				? 'Privacy policy saved. Listmonk will reload after active campaigns finish.'
				: 'Privacy policy saved. Listmonk is reloading and may be briefly unavailable.');
			setTimeout(() => void revalidate(getEmailPrivacyPolicy.key), 2_000);
		} catch (caught) {
			setError(visibleError(caught, 'The privacy policy could not be saved.'));
		} finally {
			setPending(false);
		}
	}

	return (
		<section class="email-settings-page">
			<PageHeader eyebrow="System settings" title="Email privacy" description="Control tracking, recipient self-service, and the domains accepted by subscriptions and imports." />
			<Show when={policy()}>{(resolved) => <EmailPrivacyForm initial={resolved()} canEdit={canEdit()} pending={pending()} error={error()} onSubmit={(command) => void save(command)} />}</Show>
		</section>
	);
}
