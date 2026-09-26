import { can } from '@yah/admin-core/permissions';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo } from 'solid-js';
import { EmailPerformanceSettingsForm } from '~/features/email-settings/performance-form';
import { getEmailPerformanceSettings, saveEmailPerformanceSettings } from '~/features/email-settings/server';
import { createEmailSettingsSave } from '~/features/email-settings/save-task';
import { requireSession } from '~/platform/auth/session';
import { PageHeader } from '~/ui/page-header';

export const route = defineFileRoute('/settings/email/performance', {
	preload: () => void getEmailPerformanceSettings(),
});

export default function EmailPerformanceSettingsPage() {
	const settings = createMemo(() => getEmailPerformanceSettings());
	const session = createMemo(() => requireSession());
	const canManage = createMemo(() => can(session(), 'provider', 'manage'));
	const task = createEmailSettingsSave({
		save: saveEmailPerformanceSettings,
		queryKey: getEmailPerformanceSettings.key,
		savedMessage: 'Performance settings saved.',
		failureMessage: 'The performance settings could not be saved.',
	});

	return (
		<section class="email-settings-page">
			<PageHeader eyebrow="Email settings" title="Email performance" description="Control provider throughput, delivery safeguards, and the optional slow-query cache. Changes require email-provider management permission." />
			<Show when={settings()}>
				{(resolved) => <EmailPerformanceSettingsForm initial={resolved()} canManage={canManage()} pending={task.pending()} error={task.error()} onSubmit={(command) => void task.save(command)} />}
			</Show>
		</section>
	);
}
