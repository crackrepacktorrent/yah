import { can } from '@yah/admin-core/permissions';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo } from 'solid-js';
import { EmailPrivacyForm } from '~/features/email-settings/privacy-form';
import { getEmailPrivacyPolicy, saveEmailPrivacyPolicy } from '~/features/email-settings/server';
import { createEmailSettingsSave } from '~/features/email-settings/save-task';
import { requireSession } from '~/platform/auth/session';
import { PageHeader } from '~/ui/page-header';

export const route = defineFileRoute('/settings/email/privacy', {
	preload: () => void getEmailPrivacyPolicy(),
});

export default function EmailPrivacyPage() {
	const policy = createMemo(() => getEmailPrivacyPolicy());
	const session = createMemo(() => requireSession());
	const canEdit = createMemo(() => can(session(), 'settings', 'edit'));
	const task = createEmailSettingsSave({
		save: saveEmailPrivacyPolicy,
		queryKey: getEmailPrivacyPolicy.key,
		savedMessage: 'Privacy policy saved.',
		failureMessage: 'The privacy policy could not be saved.',
	});

	return (
		<section class="email-settings-page">
			<PageHeader eyebrow="Email settings" title="Email privacy" description="Control tracking, recipient self-service, and the domains accepted by subscriptions and imports." />
			<Show when={policy()}>{(resolved) => <EmailPrivacyForm initial={resolved()} canEdit={canEdit()} pending={task.pending()} error={task.error()} onSubmit={(command) => void task.save(command)} />}</Show>
		</section>
	);
}
