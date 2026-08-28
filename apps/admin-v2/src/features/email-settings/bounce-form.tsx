import { For, Show, createSignal, untrack } from 'solid-js';
import { GO_DURATION_HTML_PATTERN, type BounceMailbox, type EmailBounceSettings, type SaveEmailBounceSettingsCommand } from './contracts';
import { SettingToggle } from './setting-toggle';

type MailboxDraft = Omit<BounceMailbox, 'hasPassword'> & { hasPassword: boolean; password: string };
type BounceKind = keyof EmailBounceSettings['actions'];

const bounceKinds: Array<{ key: BounceKind; label: string }> = [
	{ key: 'soft', label: 'Soft bounce' },
	{ key: 'hard', label: 'Hard bounce' },
	{ key: 'complaint', label: 'Complaint' },
];

function credentialHelp(saved: boolean): string {
	return saved ? 'Leave blank to retain the saved credential.' : 'Enter a credential before enabling this provider.';
}

function SecretField(props: {
	label: string;
	value: string;
	hasSaved: boolean;
	disabled: boolean;
	onInput: (value: string) => void;
}) {
	return (
		<label class="form-field">
			<span>{props.label}</span>
			<input
				type="password"
				value={props.value}
				maxlength="10000"
				disabled={props.disabled}
				placeholder={props.hasSaved ? 'Saved credential' : ''}
				onInput={(event) => props.onInput(event.currentTarget.value)}
			/>
			<small>{credentialHelp(props.hasSaved)}</small>
		</label>
	);
}

export function EmailBounceSettingsForm(props: {
	initial: EmailBounceSettings;
	canManage: boolean;
	canDeleteSubscribers: boolean;
	pending: boolean;
	error: string;
	onSubmit: (command: SaveEmailBounceSettingsCommand) => Promise<boolean>;
}) {
	const initial = untrack(() => props.initial);
	const [enabled, setEnabled] = createSignal(initial.enabled);
	const [actions, setActions] = createSignal(structuredClone(initial.actions));
	const [webhooksEnabled, setWebhooksEnabled] = createSignal(initial.webhooksEnabled);
	const [sesEnabled, setSesEnabled] = createSignal(initial.sesEnabled);
	const [azureEnabled, setAzureEnabled] = createSignal(initial.azure.enabled);
	const [azureHasSecret, setAzureHasSecret] = createSignal(initial.azure.hasSharedSecret);
	const [azureSecret, setAzureSecret] = createSignal('');
	const [azureSecretHeader, setAzureSecretHeader] = createSignal(initial.azure.sharedSecretHeader);
	const [sendgridEnabled, setSendgridEnabled] = createSignal(initial.sendgrid.enabled);
	const [sendgridHasKey, setSendgridHasKey] = createSignal(initial.sendgrid.hasKey);
	const [sendgridKey, setSendgridKey] = createSignal('');
	const [postmarkEnabled, setPostmarkEnabled] = createSignal(initial.postmark.enabled);
	const [postmarkHasPassword, setPostmarkHasPassword] = createSignal(initial.postmark.hasPassword);
	const [postmarkUsername, setPostmarkUsername] = createSignal(initial.postmark.username);
	const [postmarkPassword, setPostmarkPassword] = createSignal('');
	const [forwardEmailEnabled, setForwardEmailEnabled] = createSignal(initial.forwardEmail.enabled);
	const [forwardEmailHasKey, setForwardEmailHasKey] = createSignal(initial.forwardEmail.hasKey);
	const [forwardEmailKey, setForwardEmailKey] = createSignal('');
	const [lettermintEnabled, setLettermintEnabled] = createSignal(initial.lettermint.enabled);
	const [lettermintHasKey, setLettermintHasKey] = createSignal(initial.lettermint.hasKey);
	const [lettermintKey, setLettermintKey] = createSignal('');
	const [mailboxes, setMailboxes] = createSignal<MailboxDraft[]>(initial.mailboxes.map((mailbox) => ({ ...mailbox, password: '' })));
	const [acknowledgeDelete, setAcknowledgeDelete] = createSignal(false);
	const disabled = () => !props.canManage || props.pending;
	const hasDeleteAction = () => Object.values(actions()).some(({ action }) => action === 'delete');

	function updateAction(kind: BounceKind, field: 'count' | 'action', value: number | EmailBounceSettings['actions'][BounceKind]['action']): void {
		setActions((current) => ({ ...current, [kind]: { ...current[kind], [field]: value } }));
	}

	function updateMailbox(index: number, update: Partial<MailboxDraft>): void {
		setMailboxes((current) => current.map((mailbox, mailboxIndex) => ({
			...mailbox,
			...(mailboxIndex === index ? update : update.enabled ? { enabled: false } : {}),
		})));
	}

	function addMailbox(): void {
		setMailboxes((current) => [...current, {
			uuid: crypto.randomUUID(),
			enabled: false,
			type: 'pop',
			host: '',
			port: 995,
			authProtocol: 'userpass',
			username: '',
			hasPassword: false,
			password: '',
			tlsEnabled: true,
			tlsSkipVerify: false,
			scanInterval: '15m',
		}]);
	}

	async function submit(): Promise<void> {
		const replacements = {
			azure: azureSecret(),
			sendgrid: sendgridKey(),
			postmark: postmarkPassword(),
			forwardEmail: forwardEmailKey(),
			lettermint: lettermintKey(),
		};
		const saved = await props.onSubmit({
			enabled: enabled(),
			actions: actions(),
			webhooksEnabled: webhooksEnabled(),
			sesEnabled: sesEnabled(),
			azure: { enabled: azureEnabled(), sharedSecret: replacements.azure || null, sharedSecretHeader: azureSecretHeader() },
			sendgrid: { enabled: sendgridEnabled(), key: replacements.sendgrid || null },
			postmark: { enabled: postmarkEnabled(), username: postmarkUsername(), password: replacements.postmark || null },
			forwardEmail: { enabled: forwardEmailEnabled(), key: replacements.forwardEmail || null },
			lettermint: { enabled: lettermintEnabled(), key: replacements.lettermint || null },
			mailboxes: mailboxes().map(({ hasPassword: _hasPassword, password, ...mailbox }) => ({ ...mailbox, password: password || null })),
			acknowledgeDelete: acknowledgeDelete(),
		});
		if (!saved) return;
		if (replacements.azure) setAzureHasSecret(true);
		if (replacements.sendgrid) setSendgridHasKey(true);
		if (replacements.postmark) setPostmarkHasPassword(true);
		if (replacements.forwardEmail) setForwardEmailHasKey(true);
		if (replacements.lettermint) setLettermintHasKey(true);
		setAzureSecret('');
		setSendgridKey('');
		setPostmarkPassword('');
		setForwardEmailKey('');
		setLettermintKey('');
		setMailboxes((current) => current.map((mailbox) => ({
			...mailbox,
			hasPassword: mailbox.hasPassword || mailbox.password.length > 0,
			password: '',
		})));
		setAcknowledgeDelete(false);
	}

	return (
		<form class="settings-form" onSubmit={(event) => {
			event.preventDefault();
			void submit();
		}}>
			<Show when={props.error}>{(message) => <p class="field-error" role="alert">{message()}</p>}</Show>
			<fieldset class="settings-card" disabled={disabled()}>
				<legend>Processing policy</legend>
				<SettingToggle label="Enable bounce processing" help="Processes delivery failures received through the configured webhook or POP channels." checked={enabled()} disabled={disabled()} onChange={setEnabled} />
				<div class="bounce-action-grid" role="group" aria-label="Bounce actions">
					<For each={bounceKinds}>{({ key, label }) => (
						<div class="bounce-action-row">
							<strong>{label}</strong>
							<label class="form-field">
								<span>Count</span>
								<input type="number" min="1" max="1000" required value={actions()[key].count} disabled={disabled() || !enabled()} onInput={(event) => updateAction(key, 'count', Number(event.currentTarget.value))} />
							</label>
							<label class="form-field">
								<span>Action</span>
								<select value={actions()[key].action} disabled={disabled() || !enabled()} onChange={(event) => updateAction(key, 'action', event.currentTarget.value as EmailBounceSettings['actions'][BounceKind]['action'])}>
									<option value="none">Do nothing</option>
									<option value="unsubscribe">Unsubscribe</option>
									<option value="blocklist">Blocklist</option>
									<option value="delete" disabled={!props.canDeleteSubscribers}>Delete subscriber</option>
								</select>
							</label>
						</div>
					)}</For>
				</div>
				<Show when={hasDeleteAction()}>
					<label class="settings-danger-ack">
						<input type="checkbox" checked={acknowledgeDelete()} required disabled={disabled()} onChange={(event) => setAcknowledgeDelete(event.currentTarget.checked)} />
						<span><strong>I understand that “Delete subscriber” is permanent.</strong><small>Future matching bounces will erase subscriber records, not merely unsubscribe or blocklist them.</small></span>
					</label>
				</Show>
			</fieldset>

			<fieldset class="settings-card" disabled={disabled()}>
				<legend>Webhook providers</legend>
				<p class="settings-note settings-note--flush">Disabling a provider retains its saved credential. Listmonk’s full settings API does not support an unambiguous credential-clear operation.</p>
				<SettingToggle label="Accept bounce webhooks" help="Enables Listmonk’s provider-specific webhook handlers." checked={webhooksEnabled()} disabled={disabled() || !enabled()} onChange={setWebhooksEnabled} />
				<div class="settings-provider-list" aria-disabled={webhooksEnabled() ? undefined : 'true'}>
					<SettingToggle label="Amazon SES" help="Accept Amazon SES bounce notifications." checked={sesEnabled()} disabled={disabled() || !enabled() || !webhooksEnabled()} onChange={setSesEnabled} />
					<section class="settings-provider-card">
						<SettingToggle label="Azure Communication Services" help="Authenticate Azure event-grid webhook requests with a shared secret." checked={azureEnabled()} disabled={disabled() || !enabled() || !webhooksEnabled()} onChange={setAzureEnabled} />
						<div class="settings-domain-grid">
					<SecretField label="Shared secret" value={azureSecret()} hasSaved={azureHasSecret()} disabled={disabled() || !azureEnabled()} onInput={setAzureSecret} />
							<label class="form-field">
								<span>Secret header</span>
								<input value={azureSecretHeader()} maxlength="255" disabled={disabled() || !azureEnabled()} onInput={(event) => setAzureSecretHeader(event.currentTarget.value)} />
								<small>HTTP header containing the shared secret.</small>
							</label>
						</div>
					</section>
					<section class="settings-provider-card">
						<SettingToggle label="SendGrid" help="Accept signed SendGrid bounce events." checked={sendgridEnabled()} disabled={disabled() || !enabled() || !webhooksEnabled()} onChange={setSendgridEnabled} />
						<SecretField label="Verification key" value={sendgridKey()} hasSaved={sendgridHasKey()} disabled={disabled() || !sendgridEnabled()} onInput={setSendgridKey} />
					</section>
					<section class="settings-provider-card">
						<SettingToggle label="Postmark" help="Accept Postmark bounce events with basic authentication." checked={postmarkEnabled()} disabled={disabled() || !enabled() || !webhooksEnabled()} onChange={setPostmarkEnabled} />
						<div class="settings-domain-grid">
							<label class="form-field">
								<span>Username</span>
								<input value={postmarkUsername()} maxlength="1000" disabled={disabled() || !postmarkEnabled()} onInput={(event) => setPostmarkUsername(event.currentTarget.value)} />
							</label>
							<SecretField label="Password" value={postmarkPassword()} hasSaved={postmarkHasPassword()} disabled={disabled() || !postmarkEnabled()} onInput={setPostmarkPassword} />
						</div>
					</section>
					<section class="settings-provider-card">
						<SettingToggle label="Forward Email" help="Accept Forward Email bounce webhooks." checked={forwardEmailEnabled()} disabled={disabled() || !enabled() || !webhooksEnabled()} onChange={setForwardEmailEnabled} />
						<SecretField label="API key" value={forwardEmailKey()} hasSaved={forwardEmailHasKey()} disabled={disabled() || !forwardEmailEnabled()} onInput={setForwardEmailKey} />
					</section>
					<section class="settings-provider-card">
						<SettingToggle label="Lettermint" help="Accept Lettermint bounce webhooks." checked={lettermintEnabled()} disabled={disabled() || !enabled() || !webhooksEnabled()} onChange={setLettermintEnabled} />
						<SecretField label="API key" value={lettermintKey()} hasSaved={lettermintHasKey()} disabled={disabled() || !lettermintEnabled()} onInput={setLettermintKey} />
					</section>
				</div>
			</fieldset>

			<fieldset class="settings-card" disabled={disabled()}>
				<legend>POP bounce mailbox</legend>
				<p class="settings-note settings-note--flush">Listmonk processes at most one enabled mailbox. Additional saved mailbox records are preserved and can be enabled here one at a time.</p>
				<For each={mailboxes()} keyed={(mailbox) => mailbox.uuid}>{(mailbox, index) => (
					<fieldset class="settings-provider-card bounce-mailbox-card">
						<legend>Mailbox {index() + 1}</legend>
						<SettingToggle label="Enable this mailbox" help="Enabling it disables any other mailbox in this draft." checked={mailbox().enabled} disabled={disabled() || !enabled()} onChange={(value) => updateMailbox(index(), { enabled: value })} />
						<div class="smtp-fields">
							<label class="form-field smtp-wide">
								<span>Host</span>
								<input value={mailbox().host} maxlength="255" disabled={disabled()} onInput={(event) => updateMailbox(index(), { host: event.currentTarget.value })} />
							</label>
							<label class="form-field">
								<span>Port</span>
								<input type="number" min="1" max="65535" value={mailbox().port} disabled={disabled()} onInput={(event) => updateMailbox(index(), { port: Number(event.currentTarget.value) })} />
							</label>
							<label class="form-field">
								<span>Authentication</span>
								<select value={mailbox().authProtocol} disabled={disabled()} onChange={(event) => updateMailbox(index(), { authProtocol: event.currentTarget.value as MailboxDraft['authProtocol'] })}>
									<option value="userpass">Username and password</option>
									<option value="none">None</option>
								</select>
							</label>
							<label class="form-field">
								<span>Username</span>
								<input value={mailbox().username} maxlength="1000" disabled={disabled() || mailbox().authProtocol === 'none'} onInput={(event) => updateMailbox(index(), { username: event.currentTarget.value })} />
							</label>
							<SecretField label="Password" value={mailbox().password} hasSaved={mailbox().hasPassword} disabled={disabled() || mailbox().authProtocol === 'none'} onInput={(password) => updateMailbox(index(), { password })} />
							<label class="form-field">
								<span>Scan interval</span>
								<input value={mailbox().scanInterval} pattern={GO_DURATION_HTML_PATTERN} maxlength="64" disabled={disabled()} onInput={(event) => updateMailbox(index(), { scanInterval: event.currentTarget.value })} />
								<small>At least one minute, for example 15m or 1h.</small>
							</label>
						</div>
						<div class="settings-inline-toggles">
							<SettingToggle label="Use TLS" help="Encrypt the POP connection." checked={mailbox().tlsEnabled} disabled={disabled()} onChange={(value) => updateMailbox(index(), { tlsEnabled: value })} />
							<SettingToggle label="Skip TLS verification" help="Unsafe except for a deliberate private certificate setup." checked={mailbox().tlsSkipVerify} disabled={disabled() || !mailbox().tlsEnabled} onChange={(value) => updateMailbox(index(), { tlsSkipVerify: value })} />
						</div>
						<button class="button button--danger" type="button" disabled={disabled()} onClick={() => setMailboxes((current) => current.filter((_, mailboxIndex) => mailboxIndex !== index()))}>Remove mailbox configuration</button>
					</fieldset>
				)}</For>
				<Show when={props.canManage}><button class="button button--secondary" type="button" disabled={props.pending || mailboxes().length >= 100} onClick={addMailbox}>Add bounce mailbox</button></Show>
			</fieldset>
			<Show when={props.canManage}><div class="form-actions"><button class="button" type="submit" disabled={props.pending}>{props.pending ? 'Saving…' : 'Save bounce settings'}</button></div></Show>
		</form>
	);
}
