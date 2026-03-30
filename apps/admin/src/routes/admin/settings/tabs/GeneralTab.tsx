import { Show, createSignal, untrack } from 'solid-js';
import { Button, FormField, Input, Section, Switch, TagInput } from '~/components/admin';
import type { TabProps } from '../email';

export function GeneralTab(props: TabProps) {
	const [siteName, setSiteName] = createSignal(untrack(() => props.settings['app.site_name'] ?? ''));
	const [rootUrl, setRootUrl] = createSignal(untrack(() => props.settings['app.root_url'] ?? ''));
	const [logoUrl, setLogoUrl] = createSignal(untrack(() => props.settings['app.logo_url'] ?? ''));
	const [faviconUrl, setFaviconUrl] = createSignal(untrack(() => props.settings['app.favicon_url'] ?? ''));
	const [fromEmail, setFromEmail] = createSignal(untrack(() => props.settings['app.from_email'] ?? ''));
	const [notifyEmails, setNotifyEmails] = createSignal(
		untrack(() => props.settings['app.notify_emails'] ?? [])
	);
	const [sendOptinConfirmation, setSendOptinConfirmation] = createSignal(
		untrack(() => props.settings['app.send_optin_confirmation'] ?? false)
	);
	const [enablePublicSubPage, setEnablePublicSubPage] = createSignal(
		untrack(() => props.settings['app.enable_public_subscription_page'] ?? false)
	);
	const [enablePublicArchive, setEnablePublicArchive] = createSignal(
		untrack(() => props.settings['app.enable_public_archive'] ?? false)
	);
	const [enablePublicArchiveRss, setEnablePublicArchiveRss] = createSignal(
		untrack(() => props.settings['app.enable_public_archive_rss_content'] ?? false)
	);
	const [checkUpdates, setCheckUpdates] = createSignal(
		untrack(() => props.settings['app.check_updates'] ?? true)
	);
	const [saving, setSaving] = createSignal(false);

	async function handleSave() {
		setSaving(true);
		try {
			await props.onSave({
				'app.site_name': siteName(),
				'app.root_url': rootUrl().replace(/\/+$/, ''),
				'app.logo_url': logoUrl(),
				'app.favicon_url': faviconUrl(),
				'app.from_email': fromEmail(),
				'app.notify_emails': notifyEmails(),
				'app.send_optin_confirmation': sendOptinConfirmation(),
				'app.enable_public_subscription_page': enablePublicSubPage(),
				'app.enable_public_archive': enablePublicArchive(),
				'app.enable_public_archive_rss_content': enablePublicArchiveRss(),
				'app.check_updates': checkUpdates(),
			});
		} finally {
			setSaving(false);
		}
	}

	return (
		<div class="settings-sections">
			<Section title="Site identity">
				<div class="form-fields">
					<FormField label="Site name">
						<Input value={siteName()} onInput={(e) => setSiteName(e.currentTarget.value)} disabled={!props.canEdit} />
					</FormField>
					<FormField label="Root URL" hint="Public URL of the installation (no trailing slash).">
						<Input type="url" value={rootUrl()} onInput={(e) => setRootUrl(e.currentTarget.value)} disabled={!props.canEdit} placeholder="https://listmonk.yoursite.com" />
					</FormField>
					<div class="form-row">
						<FormField label="Logo URL" hint="Optional. Full URL to logo shown on public pages.">
							<Input value={logoUrl()} onInput={(e) => setLogoUrl(e.currentTarget.value)} disabled={!props.canEdit} placeholder="https://yoursite.com/logo.png" />
						</FormField>
						<FormField label="Favicon URL" hint="Optional. Full URL to favicon shown on public pages.">
							<Input value={faviconUrl()} onInput={(e) => setFaviconUrl(e.currentTarget.value)} disabled={!props.canEdit} placeholder="https://yoursite.com/favicon.png" />
						</FormField>
					</div>
				</div>
			</Section>

			<Section title="Email defaults">
				<div class="form-fields">
					<FormField label="Default from email" hint="Default from address on outgoing campaign emails. Can be changed per campaign.">
						<Input value={fromEmail()} onInput={(e) => setFromEmail(e.currentTarget.value)} disabled={!props.canEdit} placeholder="Listmonk <noreply@yoursite.com>" />
					</FormField>
					<FormField label="Admin notification emails" hint="Receives import updates, campaign completion, and failures.">
						<TagInput
							tags={notifyEmails()}
							onChange={setNotifyEmails}
							validate={(v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
							placeholder="admin@example.com"
							disabled={!props.canEdit}
						/>
					</FormField>
					<Switch
						label="Send opt-in confirmation"
						hint="Send an opt-in confirmation email when subscribers sign up or are added by an admin."
						checked={sendOptinConfirmation()}
						onChange={setSendOptinConfirmation}
						disabled={!props.canEdit}
					/>
				</div>
			</Section>

			<Section title="Public pages">
				<div class="form-fields">
					<Switch
						label="Enable public subscription page"
						hint="Show a public page with all public lists for people to subscribe."
						checked={enablePublicSubPage()}
						onChange={setEnablePublicSubPage}
						disabled={!props.canEdit}
					/>
					<Switch
						label="Enable public mailing list archive"
						hint="Publish campaigns with archiving enabled on the public website."
						checked={enablePublicArchive()}
						onChange={setEnablePublicArchive}
						disabled={!props.canEdit}
					/>
					<Show when={enablePublicArchive()}>
						<Switch
							label="Show full content in RSS feed"
							hint="If disabled, only the title and link elements are shown."
							checked={enablePublicArchiveRss()}
							onChange={setEnablePublicArchiveRss}
							disabled={!props.canEdit}
						/>
					</Show>
				</div>
			</Section>

			<Section title="Updates">
				<div class="form-fields">
					<Switch
						label="Check for updates"
						hint="Periodically check for new app releases and notify."
						checked={checkUpdates()}
						onChange={setCheckUpdates}
						disabled={!props.canEdit}
					/>
				</div>
			</Section>

			<Show when={props.canEdit}>
				<div class="tab-actions">
					<Button onClick={handleSave} disabled={saving()}>{saving() ? 'Saving…' : 'Save'}</Button>
				</div>
			</Show>
		</div>
	);
}
