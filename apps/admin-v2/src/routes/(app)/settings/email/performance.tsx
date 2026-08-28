import { can } from '@yah/admin-core/permissions';
import { revalidate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo, createSignal } from 'solid-js';
import type { SaveEmailPerformanceSettingsCommand } from '~/features/email-settings/contracts';
import { EmailPerformanceSettingsForm } from '~/features/email-settings/performance-form';
import { getEmailPerformanceSettings, saveEmailPerformanceSettings } from '~/features/email-settings/server';
import { requireSession } from '~/platform/auth/session';
import { PageHeader } from '~/ui/page-header';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/settings/email/performance', {
	preload: () => void getEmailPerformanceSettings(),
});

export default function EmailPerformanceSettingsPage() {
	const settings = createMemo(() => getEmailPerformanceSettings());
	const session = createMemo(() => requireSession());
	const canManage = createMemo(() => can(session(), 'provider', 'manage'));
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');

	async function save(command: SaveEmailPerformanceSettingsCommand): Promise<void> {
		setError('');
		setPending(true);
		try {
			const result = await saveEmailPerformanceSettings(command);
			toast.success(result.needsRestart
				? 'Performance settings saved. Listmonk will reload after active campaigns finish.'
				: 'Performance settings saved. Listmonk is reloading and may be briefly unavailable.');
			setTimeout(() => void revalidate(getEmailPerformanceSettings.key), 2_000);
		} catch (caught) {
			setError(visibleError(caught, 'The performance settings could not be saved.'));
		} finally {
			setPending(false);
		}
	}

	return (
		<section class="email-settings-page">
			<PageHeader eyebrow="System settings" title="Email performance" description="Control provider throughput, delivery safeguards, and the optional slow-query cache. Changes require email-provider management permission." />
			<Show when={settings()}>
				{(resolved) => <EmailPerformanceSettingsForm initial={resolved()} canManage={canManage()} pending={pending()} error={error()} onSubmit={(command) => void save(command)} />}
			</Show>
		</section>
	);
}
