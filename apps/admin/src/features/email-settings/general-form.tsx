import { Show, createSignal, untrack } from 'solid-js';
import { InputField, TextareaField } from '~/ui/form-field';
import type { EmailGeneralSettings, SaveEmailGeneralSettingsCommand } from './contracts';
import { SettingToggle } from './setting-toggle';

function parseEmails(value: string): string[] {
	return value.split(/[\n,]+/u).map((email) => email.trim()).filter(Boolean);
}

export function EmailGeneralSettingsForm(props: {
	initial: EmailGeneralSettings;
	canEdit: boolean;
	pending: boolean;
	error: string;
	onSubmit: (command: SaveEmailGeneralSettingsCommand) => void;
}) {
	const initial = untrack(() => props.initial);
	const [siteName, setSiteName] = createSignal(initial.siteName);
	const [logoUrl, setLogoUrl] = createSignal(initial.logoUrl);
	const [faviconUrl, setFaviconUrl] = createSignal(initial.faviconUrl);
	const [fromEmail, setFromEmail] = createSignal(initial.fromEmail);
	const [notifyEmails, setNotifyEmails] = createSignal(initial.notifyEmails.join('\n'));
	const [sendOptInConfirmation, setSendOptInConfirmation] = createSignal(initial.sendOptInConfirmation);
	const [showOptInPage, setShowOptInPage] = createSignal(initial.showOptInPage);
	const [publicArchiveEnabled, setPublicArchiveEnabled] = createSignal(initial.publicArchiveEnabled);
	const [publicArchiveRssContentEnabled, setPublicArchiveRssContentEnabled] = createSignal(initial.publicArchiveRssContentEnabled);

	return (
		<form class="settings-form" onSubmit={(event) => {
			event.preventDefault();
			props.onSubmit({
				siteName: siteName(),
				logoUrl: logoUrl(),
				faviconUrl: faviconUrl(),
				fromEmail: fromEmail(),
				notifyEmails: parseEmails(notifyEmails()),
				sendOptInConfirmation: sendOptInConfirmation(),
				showOptInPage: showOptInPage(),
				publicArchiveEnabled: publicArchiveEnabled(),
				publicArchiveRssContentEnabled: publicArchiveRssContentEnabled(),
			});
		}}>
			<Show when={props.error}>{(message) => <p class="field-error" role="alert">{message()}</p>}</Show>
			<fieldset class="settings-card" disabled={!props.canEdit || props.pending}>
				<legend>Recipient-facing identity</legend>
				<InputField label="Site name" help="Shown on Listmonk’s recipient pages and generated messages." value={siteName()} maxlength="300" required onInput={(event) => setSiteName(event.currentTarget.value)} />
				<div class="settings-domain-grid">
					<InputField label="Logo URL" help="Optional HTTP(S) image shown on recipient pages." type="url" value={logoUrl()} maxlength="300" placeholder="https://example.org/logo.png" onInput={(event) => setLogoUrl(event.currentTarget.value)} />
					<InputField label="Favicon URL" help="Optional HTTP(S) icon for recipient pages." type="url" value={faviconUrl()} maxlength="300" placeholder="https://example.org/favicon.png" onInput={(event) => setFaviconUrl(event.currentTarget.value)} />
				</div>
			</fieldset>
			<fieldset class="settings-card" disabled={!props.canEdit || props.pending}>
				<legend>Message defaults</legend>
				<InputField label="Default from address" help="Used by campaigns, transactional email, SMTP tests, and subscriber exports unless a workflow overrides it." value={fromEmail()} maxlength="1000" required placeholder="YAH &lt;hello@example.org&gt;" onInput={(event) => setFromEmail(event.currentTarget.value)} />
				<TextareaField label="Operator notification emails" help="One address per line. Listmonk sends campaign, import, and failure notices to these recipients." value={notifyEmails()} rows="4" maxlength="33000" placeholder="operator@example.org" onInput={(event) => setNotifyEmails(event.currentTarget.value)} />
				<SettingToggle label="Send opt-in confirmation messages" help="Required for YAH’s double-opt-in subscription flow to deliver confirmation email." checked={sendOptInConfirmation()} disabled={!props.canEdit || props.pending} onChange={setSendOptInConfirmation} />
			</fieldset>
			<fieldset class="settings-card" disabled={!props.canEdit || props.pending}>
				<legend>Recipient pages</legend>
				<SettingToggle label="Show the opt-in confirmation page" help="Shows a confirmation page before a recipient confirms through an opt-in link." checked={showOptInPage()} disabled={!props.canEdit || props.pending} onChange={setShowOptInPage} />
				<SettingToggle label="Enable the public campaign archive" help="Publishes campaigns whose individual archive option is enabled." checked={publicArchiveEnabled()} disabled={!props.canEdit || props.pending} onChange={setPublicArchiveEnabled} />
				<SettingToggle label="Include full campaign content in archive RSS" help="When disabled, the RSS feed contains campaign titles and links only." checked={publicArchiveRssContentEnabled()} disabled={!props.canEdit || props.pending || !publicArchiveEnabled()} onChange={setPublicArchiveRssContentEnabled} />
				<Show when={!publicArchiveEnabled()}><p class="settings-note">The stored RSS preference is retained while the public archive is disabled.</p></Show>
			</fieldset>
			<Show when={props.canEdit}><div class="form-actions"><button class="button" type="submit" disabled={props.pending}>{props.pending ? 'Saving…' : 'Save general settings'}</button></div></Show>
		</form>
	);
}
