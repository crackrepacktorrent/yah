import { can } from '@yah/admin-core/permissions';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo } from 'solid-js';
import { EmailBounceSettingsForm } from '~/features/email-settings/bounce-form';
import { getEmailBounceSettings, getEmailGeneralSettings, saveEmailBounceSettings } from '~/features/email-settings/server';
import { createEmailSettingsSave } from '~/features/email-settings/save-task';
import { requireSession } from '~/platform/auth/session';
import { PageHeader } from '~/ui/page-header';

export const route = defineFileRoute('/settings/email/bounces', {
	preload: () => void getEmailBounceSettings(),
});

export default function EmailBounceSettingsPage() {
	const settings = createMemo(() => getEmailBounceSettings());
	const session = createMemo(() => requireSession());
	const canManage = createMemo(() => can(session(), 'provider', 'manage'));
	const canDeleteSubscribers = createMemo(() => can(session(), 'subscriber', 'delete'));
	const task = createEmailSettingsSave({
		save: saveEmailBounceSettings,
		queryKey: [getEmailBounceSettings.key, getEmailGeneralSettings.key],
		savedMessage: 'Bounce settings saved.',
		failureMessage: 'The bounce settings could not be saved.',
	});

	return (
		<section class="email-settings-page">
			<PageHeader eyebrow="Email settings" title="Bounce processing" description="Manage bounce actions, provider webhooks, and the POP mailbox without exposing saved credentials to the browser." />
			<Show when={settings()}>
				{(resolved) => <EmailBounceSettingsForm initial={resolved()} canManage={canManage()} canDeleteSubscribers={canDeleteSubscribers()} pending={task.pending()} error={task.error()} onSubmit={task.save} />}
			</Show>
		</section>
	);
}
