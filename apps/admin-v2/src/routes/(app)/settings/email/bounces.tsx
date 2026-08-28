import { revalidate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo, createSignal } from 'solid-js';
import { EmailBounceSettingsForm } from '~/features/email-settings/bounce-form';
import type { SaveEmailBounceSettingsCommand } from '~/features/email-settings/contracts';
import { getEmailBounceSettings, saveEmailBounceSettings } from '~/features/email-settings/server';
import { requireSession } from '~/platform/auth/session';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/settings/email/bounces', {
	preload: () => void getEmailBounceSettings(),
});

export default function EmailBounceSettingsPage() {
	const settings = createMemo(() => getEmailBounceSettings());
	const session = createMemo(() => requireSession());
	const canManage = createMemo(() => session().permissions['provider']?.includes('manage') ?? false);
	const canDeleteSubscribers = createMemo(() => session().permissions['subscriber']?.includes('delete') ?? false);
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');

	async function save(command: SaveEmailBounceSettingsCommand): Promise<boolean> {
		setError('');
		setPending(true);
		try {
			const result = await saveEmailBounceSettings(command);
			toast.success(result.needsRestart
				? 'Bounce settings saved. Listmonk will reload after active campaigns finish.'
				: 'Bounce settings saved. Listmonk is reloading and may be briefly unavailable.');
			setTimeout(() => void revalidate(getEmailBounceSettings.key), 2_000);
			return true;
		} catch (caught) {
			setError(visibleError(caught, 'The bounce settings could not be saved.'));
			return false;
		} finally {
			setPending(false);
		}
	}

	return (
		<section class="email-settings-page">
			<header class="page-header">
				<div><p class="eyebrow">System settings</p><h1>Bounce processing</h1><p>Manage bounce actions, provider webhooks, and the POP mailbox without exposing saved credentials to the browser.</p></div>
			</header>
			<Show when={settings()}>
				{(resolved) => <EmailBounceSettingsForm initial={resolved()} canManage={canManage()} canDeleteSubscribers={canDeleteSubscribers()} pending={pending()} error={error()} onSubmit={save} />}
			</Show>
		</section>
	);
}
