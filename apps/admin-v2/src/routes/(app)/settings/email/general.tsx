import { revalidate } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { Show, createMemo, createSignal } from 'solid-js';
import type { SaveEmailGeneralSettingsCommand } from '~/features/email-settings/contracts';
import { EmailGeneralSettingsForm } from '~/features/email-settings/general-form';
import { getEmailGeneralSettings, saveEmailGeneralSettings } from '~/features/email-settings/server';
import { requireSession } from '~/platform/auth/session';
import { toast } from '~/ui/toast';
import { visibleError } from '~/ui/visible-error';

export const route = defineFileRoute('/settings/email/general', {
	preload: () => void getEmailGeneralSettings(),
});

export default function EmailGeneralSettingsPage() {
	const settings = createMemo(() => getEmailGeneralSettings());
	const session = createMemo(() => requireSession());
	const canEdit = createMemo(() => session().permissions['settings']?.includes('edit') ?? false);
	const [pending, setPending] = createSignal(false);
	const [error, setError] = createSignal('');

	async function save(command: SaveEmailGeneralSettingsCommand): Promise<void> {
		setError('');
		setPending(true);
		try {
			const result = await saveEmailGeneralSettings(command);
			toast.success(result.needsRestart
				? 'General email settings saved. Listmonk will reload after active campaigns finish.'
				: 'General email settings saved. Listmonk is reloading and may be briefly unavailable.');
			setTimeout(() => void revalidate(getEmailGeneralSettings.key), 2_000);
		} catch (caught) {
			setError(visibleError(caught, 'The general email settings could not be saved.'));
		} finally {
			setPending(false);
		}
	}

	return (
		<section class="email-settings-page">
			<header class="page-header"><div><p class="eyebrow">System settings</p><h1>General email settings</h1><p>Manage recipient-facing identity, email defaults, and public campaign pages.</p></div></header>
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
				<EmailGeneralSettingsForm initial={resolved()} canEdit={canEdit()} pending={pending()} error={error()} onSubmit={(command) => void save(command)} />
			</>}</Show>
		</section>
	);
}
