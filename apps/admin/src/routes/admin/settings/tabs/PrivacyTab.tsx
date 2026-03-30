import { Show, createSignal, untrack } from 'solid-js';
import { Button, Section, Switch } from '~/components';
import type { TabProps } from '../email';

export function PrivacyTab(props: TabProps) {
	const s = untrack(() => props.settings);

	const [individualTracking, setIndividualTracking] = createSignal(s['privacy.individual_tracking'] ?? false);
	const [unsubHeader, setUnsubHeader] = createSignal(s['privacy.unsubscribe_header'] ?? true);
	const [recordOptinIp, setRecordOptinIp] = createSignal(s['privacy.record_optin_ip'] ?? false);
	const [allowBlocklist, setAllowBlocklist] = createSignal(s['privacy.allow_blocklist'] ?? true);
	const [allowPreferences, setAllowPreferences] = createSignal(s['privacy.allow_preferences'] ?? true);
	const [allowExport, setAllowExport] = createSignal(s['privacy.allow_export'] ?? true);
	const [allowWipe, setAllowWipe] = createSignal(s['privacy.allow_wipe'] ?? true);
	const [domainBlocklist, setDomainBlocklist] = createSignal(
		(s['privacy.domain_blocklist'] ?? []).join('\n')
	);
	const [domainAllowlist, setDomainAllowlist] = createSignal(
		(s['privacy.domain_allowlist'] ?? []).join('\n')
	);
	const [saving, setSaving] = createSignal(false);

	async function handleSave() {
		setSaving(true);
		try {
			await props.onSave({
				'privacy.individual_tracking': individualTracking(),
				'privacy.unsubscribe_header': unsubHeader(),
				'privacy.record_optin_ip': recordOptinIp(),
				'privacy.allow_blocklist': allowBlocklist(),
				'privacy.allow_preferences': allowPreferences(),
				'privacy.allow_export': allowExport(),
				'privacy.allow_wipe': allowWipe(),
				'privacy.domain_blocklist': domainBlocklist().split('\n').map((d) => d.trim()).filter(Boolean),
				'privacy.domain_allowlist': domainAllowlist().split('\n').map((d) => d.trim()).filter(Boolean),
			});
		} finally {
			setSaving(false);
		}
	}

	return (
		<div class="settings-sections">
			<Section title="Tracking">
				<div class="form-fields">
					<Switch
						label="Individual subscriber tracking"
						hint="Track subscriber-level campaign views and clicks. When disabled, tracking continues without being linked to individuals."
						checked={individualTracking()}
						onChange={setIndividualTracking}
						disabled={!props.canEdit}
					/>
					<Switch
						label="Include List-Unsubscribe header"
						checked={unsubHeader()}
						onChange={setUnsubHeader}
						disabled={!props.canEdit}
					/>
					<Switch
						label="Record opt-in IP address"
						checked={recordOptinIp()}
						onChange={setRecordOptinIp}
						disabled={!props.canEdit}
					/>
				</div>
			</Section>

			<Section title="Subscriber self-service">
				<div class="form-fields">
					<Switch label="Allow blocklisting" checked={allowBlocklist()} onChange={setAllowBlocklist} disabled={!props.canEdit} />
					<Switch label="Allow preference changes" checked={allowPreferences()} onChange={setAllowPreferences} disabled={!props.canEdit} />
					<Switch label="Allow data export" checked={allowExport()} onChange={setAllowExport} disabled={!props.canEdit} />
					<Switch label="Allow data wipe" checked={allowWipe()} onChange={setAllowWipe} disabled={!props.canEdit} />
				</div>
			</Section>

			<Section title="Domain lists">
				<div class="form-row">
					<div class="domain-col">
						<span class="domain-label">Blocklist</span>
						<p class="settings-hint">Subscribers with these email domains are blocked from subscribing. One domain per line.</p>
						<textarea
							class="textarea"
							rows={4}
							value={domainBlocklist()}
							onInput={(e) => setDomainBlocklist(e.currentTarget.value)}
							disabled={!props.canEdit}
							placeholder="example.com"
						/>
					</div>
					<div class="domain-col">
						<span class="domain-label">Allowlist</span>
						<p class="settings-hint">If set, only these email domains are allowed to subscribe. One domain per line.</p>
						<textarea
							class="textarea"
							rows={4}
							value={domainAllowlist()}
							onInput={(e) => setDomainAllowlist(e.currentTarget.value)}
							disabled={!props.canEdit}
							placeholder="yourcompany.com"
						/>
					</div>
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
