import { can } from '@yah/admin-core/permissions';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo } from 'solid-js';
import { EmailGeneralSettingsForm } from '~/features/email-settings/general-form';
import { getEmailGeneralSettings, saveEmailGeneralSettings } from '~/features/email-settings/server';
import { createEmailSettingsSave } from '~/features/email-settings/save-task';
import { requireSession } from '~/platform/auth/session';
import { PageHeader } from '~/ui/page-header';

export const route = defineFileRoute('/settings/email/general', {
	preload: () => void getEmailGeneralSettings(),
});

export default function EmailGeneralSettingsPage() {
	const settings = createMemo(() => getEmailGeneralSettings());
	const session = createMemo(() => requireSession());
	const canEdit = createMemo(() => can(session(), 'settings', 'edit'));
	const task = createEmailSettingsSave({
		save: saveEmailGeneralSettings,
		queryKey: getEmailGeneralSettings.key,
		savedMessage: 'General email settings saved.',
		failureMessage: 'The general email settings could not be saved.',
	});

	return (
		<section class="email-settings-page">
			<PageHeader eyebrow="Email settings" title="General email settings" description="Manage recipient-facing identity, email defaults, and public campaign pages." />
			<Show when={settings()}>{(resolved) => <>
				<section class="settings-health" aria-labelledby="provider-invariants-heading">
					<div><h2 id="provider-invariants-heading">Deployment invariants</h2><p>Read-only values coupled to YAH’s web and Caddy configuration. Change these only through coordinated provider maintenance.</p></div>
					<dl>
						<div><dt>Public subscription API</dt><dd data-healthy={resolved().publicSubscriptionEnabled || undefined}>{resolved().publicSubscriptionEnabled ? 'Enabled' : 'Disabled — YAH subscriptions are broken'}</dd></div>
						<div><dt>Recipient link base</dt><dd>{resolved().rootUrl || 'Missing — recipient links are unsafe'}</dd></div>
						<div><dt>Bounce processing</dt><dd data-healthy={resolved().bounceProcessingEnabled || undefined}>{resolved().bounceProcessingEnabled ? 'Enabled' : 'Disabled — review deliverability'}</dd></div>
						<div><dt>Recipient language</dt><dd data-healthy>{resolved().language}</dd></div>
					</dl>
				</section>
				<EmailGeneralSettingsForm initial={resolved()} canEdit={canEdit()} pending={task.pending()} error={task.error()} onSubmit={(command) => void task.save(command)} />
			</>}</Show>
		</section>
	);
}
