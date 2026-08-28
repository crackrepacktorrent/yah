import { can } from '@yah/admin-core/permissions';
import { revalidate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo, createSignal } from 'solid-js';
import type { SaveEmailSettingsCommand, TestSmtpCommand } from '~/features/email-settings/contracts';
import { EmailSettingsForm } from '~/features/email-settings/form';
import { getEmailSettings, saveEmailSettings, testSmtp } from '~/features/email-settings/server';
import { requireSession } from '~/platform/auth/session';
import { PageHeader } from '~/ui/page-header';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/settings/email', {
	preload: () => void getEmailSettings(),
});

export default function EmailSettingsPage() {
	const settings = createMemo(() => getEmailSettings());
	const session = createMemo(() => requireSession());
	const canEdit = createMemo(() => can(session(), 'provider', 'manage'));
	const [pending, setPending] = createSignal(false);
	const [testingUuid, setTestingUuid] = createSignal('');
	const [error, setError] = createSignal('');

	async function save(command: SaveEmailSettingsCommand): Promise<boolean> {
		setError('');
		setPending(true);
		try {
			const result = await saveEmailSettings(command);
			toast.success(result.needsRestart
				? 'SMTP settings saved. Listmonk will reload after active campaigns finish.'
				: 'SMTP settings saved. Listmonk is reloading and may be briefly unavailable.');
			setTimeout(() => void revalidate(getEmailSettings.key), 2_000);
			return true;
		} catch (caught) {
			setError(visibleError(caught, 'The SMTP settings could not be saved.'));
			return false;
		} finally {
			setPending(false);
		}
	}

	async function test(command: TestSmtpCommand): Promise<void> {
		setError('');
		setTestingUuid(command.server.uuid);
		try {
			await testSmtp(command);
			toast.success('SMTP test message sent.');
		} catch (caught) {
			setError(visibleError(caught, 'The SMTP test could not be completed.'));
		} finally {
			setTestingUuid('');
		}
	}

	return (
		<section class="email-settings-page">
			<PageHeader eyebrow="System settings" title="Email delivery" description="Manage Listmonk’s SMTP servers. Unexposed Listmonk settings and custom SMTP headers are preserved on every save." />
			<Show when={settings()}>
				{(resolved) => <EmailSettingsForm initial={resolved().smtp} canEdit={canEdit()} pending={pending()} testingUuid={testingUuid()} error={error()} onSubmit={save} onTest={(command) => void test(command)} />}
			</Show>
		</section>
	);
}
