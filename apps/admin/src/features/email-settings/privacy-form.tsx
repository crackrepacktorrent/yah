import { For, Show, createSignal, untrack } from 'solid-js';
import { TextareaField } from '~/ui/form-field';
import type { EmailExportField, EmailPrivacyPolicy, SaveEmailPrivacyPolicyCommand } from './contracts';
import { SettingToggle } from './setting-toggle';

function parseDomains(value: string): string[] {
	return value.split(/[\n,]+/u).map((domain) => domain.trim()).filter(Boolean);
}

export function EmailPrivacyForm(props: {
	initial: EmailPrivacyPolicy;
	canEdit: boolean;
	pending: boolean;
	error: string;
	onSubmit: (command: SaveEmailPrivacyPolicyCommand) => void;
}) {
	const initial = untrack(() => props.initial);
	const [disableTracking, setDisableTracking] = createSignal(initial.disableTracking);
	const [individualTracking, setIndividualTracking] = createSignal(initial.individualTracking);
	const [unsubscribeHeader, setUnsubscribeHeader] = createSignal(initial.unsubscribeHeader);
	const [recordOptInIp, setRecordOptInIp] = createSignal(initial.recordOptInIp);
	const [allowBlocklist, setAllowBlocklist] = createSignal(initial.allowBlocklist);
	const [allowPreferences, setAllowPreferences] = createSignal(initial.allowPreferences);
	const [allowExport, setAllowExport] = createSignal(initial.allowExport);
	const [exportable, setExportable] = createSignal(initial.exportable);
	const [allowWipe, setAllowWipe] = createSignal(initial.allowWipe);
	const [domainBlocklist, setDomainBlocklist] = createSignal(initial.domainBlocklist.join('\n'));
	const [domainAllowlist, setDomainAllowlist] = createSignal(initial.domainAllowlist.join('\n'));
	const switches = [
		{ label: 'Include List-Unsubscribe header', help: 'Adds the standard one-click unsubscribe header used by supporting mail clients.', checked: unsubscribeHeader, set: setUnsubscribeHeader },
		{ label: 'Record opt-in IP address', help: 'Stores the address used when a recipient confirms a subscription.', checked: recordOptInIp, set: setRecordOptInIp },
		{ label: 'Allow recipients to blocklist themselves', help: 'Exposes Listmonk’s permanent blocklist action on recipient pages.', checked: allowBlocklist, set: setAllowBlocklist },
		{ label: 'Allow preference changes', help: 'Lets recipients manage their mailing-list memberships.', checked: allowPreferences, set: setAllowPreferences },
		{ label: 'Allow data export', help: 'Lets recipients request an email export of their stored data.', checked: allowExport, set: setAllowExport },
		{ label: 'Allow data wipe', help: 'Lets recipients permanently erase their stored data.', checked: allowWipe, set: setAllowWipe },
	];
	const exportFields: Array<{ value: EmailExportField; label: string; help: string }> = [
		{ value: 'profile', label: 'Profile', help: 'Email address, name, status, and subscriber attributes.' },
		{ value: 'subscriptions', label: 'Subscriptions', help: 'Mailing-list memberships and subscription status.' },
		{ value: 'campaign_views', label: 'Campaign views', help: 'Recorded campaign-open activity.' },
		{ value: 'link_clicks', label: 'Link clicks', help: 'Recorded campaign-link activity.' },
	];
	function setExportField(field: EmailExportField, checked: boolean): void {
		setExportable((current) => checked ? [...current, field] : current.filter((item) => item !== field));
	}

	return (
		<form class="settings-form" onSubmit={(event) => {
			event.preventDefault();
			props.onSubmit({
				disableTracking: disableTracking(), individualTracking: individualTracking(), unsubscribeHeader: unsubscribeHeader(),
				recordOptInIp: recordOptInIp(), allowBlocklist: allowBlocklist(), allowPreferences: allowPreferences(),
				allowExport: allowExport(), allowWipe: allowWipe(), domainBlocklist: parseDomains(domainBlocklist()), domainAllowlist: parseDomains(domainAllowlist()),
				exportable: exportable(),
			});
		}}>
			<Show when={props.error}>{(message) => <p class="field-error" role="alert">{message()}</p>}</Show>
			<fieldset class="settings-card" disabled={!props.canEdit || props.pending}>
				<legend>Tracking</legend>
				<SettingToggle label="Disable all message tracking" help="Stops campaign view and link tracking globally." checked={disableTracking()} disabled={!props.canEdit || props.pending} onChange={setDisableTracking} />
				<SettingToggle label="Associate tracking with individual recipients" help="When global tracking is on, stores views and clicks against a subscriber rather than only aggregate counts." checked={individualTracking()} disabled={!props.canEdit || props.pending || disableTracking()} onChange={setIndividualTracking} />
				<Show when={disableTracking()}><p class="settings-note">Individual tracking is currently inactive because all tracking is disabled. Its saved preference is retained.</p></Show>
			</fieldset>
			<fieldset class="settings-card" disabled={!props.canEdit || props.pending}>
				<legend>Recipient controls</legend>
				<For each={switches}>{(item) => <SettingToggle label={item.label} help={item.help} checked={item.checked()} disabled={!props.canEdit || props.pending} onChange={item.set} />}</For>
				<div class="settings-subsection" aria-labelledby="export-data-heading">
					<strong id="export-data-heading">Data included in recipient exports</strong>
					<p class="settings-note">Choose which Listmonk records are included when data export is enabled.</p>
					<div class="settings-option-grid">
						<For each={exportFields}>{(field) => (
							<SettingToggle
								label={field.label}
								help={field.help}
								checked={exportable().includes(field.value)}
								disabled={!props.canEdit || props.pending || !allowExport()}
								onChange={(checked) => setExportField(field.value, checked)}
							/>
						)}</For>
					</div>
				</div>
			</fieldset>
			<fieldset class="settings-card" disabled={!props.canEdit || props.pending}>
				<legend>Subscription domains</legend>
				<div class="settings-domain-grid">
					<TextareaField label="Blocked domains" help="One domain per line. Public subscriptions and imports reject these domains." value={domainBlocklist()} rows="6" maxlength="256000" placeholder="example.com" onInput={(event) => setDomainBlocklist(event.currentTarget.value)} />
					<TextareaField label="Allowed domains" help="When non-empty, subscriptions and imports accept only these domains." value={domainAllowlist()} rows="6" maxlength="256000" placeholder="yourcompany.org" onInput={(event) => setDomainAllowlist(event.currentTarget.value)} />
				</div>
			</fieldset>
			<Show when={props.canEdit}><div class="form-actions"><button class="button" type="submit" disabled={props.pending}>{props.pending ? 'Saving…' : 'Save privacy policy'}</button></div></Show>
		</form>
	);
}
