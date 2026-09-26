import { can } from '@yah/admin-core/permissions';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo, createSignal } from 'solid-js';
import type { TestSmtpCommand } from '~/features/email-settings/contracts';
import { EmailSettingsForm } from '~/features/email-settings/form';
import { getEmailSettings, saveEmailSettings, testSmtp } from '~/features/email-settings/server';
import { createEmailSettingsSave } from '~/features/email-settings/save-task';
import { requireSession } from '~/platform/auth/session';
import { PageHeader } from '~/ui/page-header';
import { toast } from '~/ui/toast';

export const route = defineFileRoute('/settings/email', {
	preload: () => void getEmailSettings(),
});

export default function EmailSettingsPage() {
	const settings = createMemo(() => getEmailSettings());
	const session = createMemo(() => requireSession());
	const canEdit = createMemo(() => can(session(), 'provider', 'manage'));
	const [testingUuid, setTestingUuid] = createSignal('');
	const task = createEmailSettingsSave({
		save: saveEmailSettings,
		queryKey: getEmailSettings.key,
		savedMessage: 'SMTP settings saved.',
		failureMessage: 'The SMTP settings could not be saved.',
	});

	function test(command: TestSmtpCommand): Promise<boolean> {
		return task.run(async () => {
			setTestingUuid(command.server.uuid);
			try {
				await testSmtp(command);
				toast.success('SMTP test message sent.');
			} finally {
				setTestingUuid('');
			}
		}, 'The SMTP test could not be completed.');
	}

	return (
		<section class="email-settings-page">
			<PageHeader eyebrow="Email settings" title="Email delivery" description="Manage Listmonk’s SMTP servers. Unexposed Listmonk settings and custom SMTP headers are preserved on every save." />
			<Show when={settings()}>
				{(resolved) => <EmailSettingsForm initial={resolved().smtp} canEdit={canEdit()} pending={task.pending()} testingUuid={testingUuid()} error={task.error()} onSubmit={task.save} onTest={(command) => void test(command)} />}
			</Show>
		</section>
	);
}
