import { Show, createSignal, untrack } from 'solid-js';
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
				<label class="form-field"><span>Site name</span><input value={siteName()} maxlength="300" required onInput={(event) => setSiteName(event.currentTarget.value)} /><small>Shown on Listmonk’s recipient pages and generated messages.</small></label>
				<div class="settings-domain-grid">
					<label class="form-field"><span>Logo URL</span><input type="url" value={logoUrl()} maxlength="300" placeholder="https://example.org/logo.png" onInput={(event) => setLogoUrl(event.currentTarget.value)} /><small>Optional HTTP(S) image shown on recipient pages.</small></label>
					<label class="form-field"><span>Favicon URL</span><input type="url" value={faviconUrl()} maxlength="300" placeholder="https://example.org/favicon.png" onInput={(event) => setFaviconUrl(event.currentTarget.value)} /><small>Optional HTTP(S) icon for recipient pages.</small></label>
				</div>
			</fieldset>
			<fieldset class="settings-card" disabled={!props.canEdit || props.pending}>
				<legend>Message defaults</legend>
				<label class="form-field"><span>Default from address</span><input value={fromEmail()} maxlength="1000" required placeholder="YAH &lt;hello@example.org&gt;" onInput={(event) => setFromEmail(event.currentTarget.value)} /><small>Used by campaigns, transactional email, SMTP tests, and subscriber exports unless a workflow overrides it.</small></label>
				<label class="form-field"><span>Operator notification emails</span><textarea value={notifyEmails()} rows="4" maxlength="33000" placeholder="operator@example.org" onInput={(event) => setNotifyEmails(event.currentTarget.value)} /><small>One address per line. Listmonk sends campaign, import, and failure notices to these recipients.</small></label>
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
