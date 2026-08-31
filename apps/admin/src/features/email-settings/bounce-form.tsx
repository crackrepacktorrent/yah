import { For, Show, createSignal, createStore, untrack } from 'solid-js';
import { InputField, SelectField } from '~/ui/form-field';
import { GO_DURATION_HTML_PATTERN, type BounceMailbox, type EmailBounceSettings, type SaveEmailBounceSettingsCommand } from './contracts';
import { SettingToggle } from './setting-toggle';
import { StoredSecretField } from './stored-secret-field';

type MailboxDraft = Omit<BounceMailbox, 'hasPassword'> & { hasPassword: boolean; password: string };
type BounceKind = keyof EmailBounceSettings['actions'];
type BounceSettingsDraft = {
	enabled: boolean;
	actions: EmailBounceSettings['actions'];
	webhooksEnabled: boolean;
	sesEnabled: boolean;
	azure: { enabled: boolean; hasSecret: boolean; secret: string; secretHeader: string };
	sendgrid: { enabled: boolean; hasKey: boolean; key: string };
	postmark: { enabled: boolean; hasPassword: boolean; username: string; password: string };
	forwardEmail: { enabled: boolean; hasKey: boolean; key: string };
	lettermint: { enabled: boolean; hasKey: boolean; key: string };
	acknowledgeDelete: boolean;
};

const bounceKinds: Array<{ key: BounceKind; label: string }> = [
	{ key: 'soft', label: 'Soft bounce' },
	{ key: 'hard', label: 'Hard bounce' },
	{ key: 'complaint', label: 'Complaint' },
];

function credentialHelp(saved: boolean): string {
	return saved ? 'Leave blank to retain the saved credential.' : 'Enter a credential before enabling this provider.';
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
	const [draft, setDraft] = createStore<BounceSettingsDraft>({
		enabled: initial.enabled,
		actions: structuredClone(initial.actions),
		webhooksEnabled: initial.webhooksEnabled,
		sesEnabled: initial.sesEnabled,
		azure: { enabled: initial.azure.enabled, hasSecret: initial.azure.hasSharedSecret, secret: '', secretHeader: initial.azure.sharedSecretHeader },
		sendgrid: { enabled: initial.sendgrid.enabled, hasKey: initial.sendgrid.hasKey, key: '' },
		postmark: { enabled: initial.postmark.enabled, hasPassword: initial.postmark.hasPassword, username: initial.postmark.username, password: '' },
		forwardEmail: { enabled: initial.forwardEmail.enabled, hasKey: initial.forwardEmail.hasKey, key: '' },
		lettermint: { enabled: initial.lettermint.enabled, hasKey: initial.lettermint.hasKey, key: '' },
		acknowledgeDelete: false,
	});
	const [mailboxes, setMailboxes] = createSignal<MailboxDraft[]>(initial.mailboxes.map((mailbox) => ({ ...mailbox, password: '' })));
	const disabled = () => !props.canManage || props.pending;
	const hasDeleteAction = () => Object.values(draft.actions).some(({ action }) => action === 'delete');

	function updateAction(kind: BounceKind, field: 'count' | 'action', value: number | EmailBounceSettings['actions'][BounceKind]['action']): void {
		setDraft((next) => {
			if (field === 'count') next.actions[kind].count = value as number;
			else next.actions[kind].action = value as EmailBounceSettings['actions'][BounceKind]['action'];
		});
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
			azure: draft.azure.secret,
			sendgrid: draft.sendgrid.key,
			postmark: draft.postmark.password,
			forwardEmail: draft.forwardEmail.key,
			lettermint: draft.lettermint.key,
		};
		const saved = await props.onSubmit({
			enabled: draft.enabled,
			actions: {
				soft: { ...draft.actions.soft },
				hard: { ...draft.actions.hard },
				complaint: { ...draft.actions.complaint },
			},
			webhooksEnabled: draft.webhooksEnabled,
			sesEnabled: draft.sesEnabled,
			azure: { enabled: draft.azure.enabled, sharedSecret: replacements.azure || null, sharedSecretHeader: draft.azure.secretHeader },
			sendgrid: { enabled: draft.sendgrid.enabled, key: replacements.sendgrid || null },
			postmark: { enabled: draft.postmark.enabled, username: draft.postmark.username, password: replacements.postmark || null },
			forwardEmail: { enabled: draft.forwardEmail.enabled, key: replacements.forwardEmail || null },
			lettermint: { enabled: draft.lettermint.enabled, key: replacements.lettermint || null },
			mailboxes: mailboxes().map(({ hasPassword: _hasPassword, password, ...mailbox }) => ({ ...mailbox, password: password || null })),
			acknowledgeDelete: draft.acknowledgeDelete,
		});
		if (!saved) return;
		setDraft((next) => {
			if (replacements.azure) next.azure.hasSecret = true;
			if (replacements.sendgrid) next.sendgrid.hasKey = true;
			if (replacements.postmark) next.postmark.hasPassword = true;
			if (replacements.forwardEmail) next.forwardEmail.hasKey = true;
			if (replacements.lettermint) next.lettermint.hasKey = true;
			next.azure.secret = '';
			next.sendgrid.key = '';
			next.postmark.password = '';
			next.forwardEmail.key = '';
			next.lettermint.key = '';
			next.acknowledgeDelete = false;
		});
		setMailboxes((current) => current.map((mailbox) => ({
			...mailbox,
			hasPassword: mailbox.hasPassword || mailbox.password.length > 0,
			password: '',
		})));
	}

	return (
		<form class="settings-form" onSubmit={(event) => {
			event.preventDefault();
			void submit();
		}}>
			<Show when={props.error}>{(message) => <p class="field-error" role="alert">{message()}</p>}</Show>
			<fieldset class="settings-card" disabled={disabled()}>
				<legend>Processing policy</legend>
				<SettingToggle label="Enable bounce processing" help="Processes delivery failures received through the configured webhook or POP channels." checked={draft.enabled} disabled={disabled()} onChange={(enabled) => setDraft((next) => { next.enabled = enabled; })} />
				<div class="bounce-action-grid" role="group" aria-label="Bounce actions">
					<For each={bounceKinds}>{({ key, label }) => (
						<div class="bounce-action-row">
							<strong>{label}</strong>
							<InputField label="Count" type="number" min="1" max="1000" required value={draft.actions[key].count} disabled={disabled() || !draft.enabled} onInput={(event) => updateAction(key, 'count', Number(event.currentTarget.value))} />
							<SelectField label="Action" value={draft.actions[key].action} disabled={disabled() || !draft.enabled} onChange={(event) => updateAction(key, 'action', event.currentTarget.value as EmailBounceSettings['actions'][BounceKind]['action'])}>
									<option value="none">Do nothing</option>
									<option value="unsubscribe">Unsubscribe</option>
									<option value="blocklist">Blocklist</option>
									<option value="delete" disabled={!props.canDeleteSubscribers}>Delete subscriber</option>
							</SelectField>
						</div>
					)}</For>
				</div>
				<Show when={hasDeleteAction()}>
					<label class="settings-danger-ack">
						<input type="checkbox" checked={draft.acknowledgeDelete} required disabled={disabled()} onChange={(event) => setDraft((next) => { next.acknowledgeDelete = event.currentTarget.checked; })} />
						<span><strong>I understand that “Delete subscriber” is permanent.</strong><small>Future matching bounces will erase subscriber records, not merely unsubscribe or blocklist them.</small></span>
					</label>
				</Show>
			</fieldset>

			<fieldset class="settings-card" disabled={disabled()}>
				<legend>Webhook providers</legend>
				<p class="settings-note settings-note--flush">Disabling a provider retains its saved credential. Listmonk’s full settings API does not support an unambiguous credential-clear operation.</p>
				<SettingToggle label="Accept bounce webhooks" help="Enables Listmonk’s provider-specific webhook handlers." checked={draft.webhooksEnabled} disabled={disabled() || !draft.enabled} onChange={(enabled) => setDraft((next) => { next.webhooksEnabled = enabled; })} />
				<div class="settings-provider-list" aria-disabled={draft.webhooksEnabled ? undefined : 'true'}>
					<SettingToggle label="Amazon SES" help="Accept Amazon SES bounce notifications." checked={draft.sesEnabled} disabled={disabled() || !draft.enabled || !draft.webhooksEnabled} onChange={(enabled) => setDraft((next) => { next.sesEnabled = enabled; })} />
					<div class="settings-provider-card">
						<SettingToggle label="Azure Communication Services" help="Authenticate Azure event-grid webhook requests with a shared secret." checked={draft.azure.enabled} disabled={disabled() || !draft.enabled || !draft.webhooksEnabled} onChange={(enabled) => setDraft((next) => { next.azure.enabled = enabled; })} />
						<div class="settings-domain-grid">
							<StoredSecretField label="Shared secret" value={draft.azure.secret} hasSaved={draft.azure.hasSecret} disabled={disabled() || !draft.azure.enabled} help={credentialHelp(draft.azure.hasSecret)} onInput={(secret) => setDraft((next) => { next.azure.secret = secret; })} />
							<InputField label="Secret header" help="HTTP header containing the shared secret." value={draft.azure.secretHeader} maxlength="255" disabled={disabled() || !draft.azure.enabled} onInput={(event) => setDraft((next) => { next.azure.secretHeader = event.currentTarget.value; })} />
						</div>
					</div>
					<div class="settings-provider-card">
						<SettingToggle label="SendGrid" help="Accept signed SendGrid bounce events." checked={draft.sendgrid.enabled} disabled={disabled() || !draft.enabled || !draft.webhooksEnabled} onChange={(enabled) => setDraft((next) => { next.sendgrid.enabled = enabled; })} />
						<StoredSecretField label="Verification key" value={draft.sendgrid.key} hasSaved={draft.sendgrid.hasKey} disabled={disabled() || !draft.sendgrid.enabled} help={credentialHelp(draft.sendgrid.hasKey)} onInput={(key) => setDraft((next) => { next.sendgrid.key = key; })} />
					</div>
					<div class="settings-provider-card">
						<SettingToggle label="Postmark" help="Accept Postmark bounce events with basic authentication." checked={draft.postmark.enabled} disabled={disabled() || !draft.enabled || !draft.webhooksEnabled} onChange={(enabled) => setDraft((next) => { next.postmark.enabled = enabled; })} />
						<div class="settings-domain-grid">
							<InputField label="Username" value={draft.postmark.username} maxlength="1000" disabled={disabled() || !draft.postmark.enabled} onInput={(event) => setDraft((next) => { next.postmark.username = event.currentTarget.value; })} />
							<StoredSecretField label="Password" value={draft.postmark.password} hasSaved={draft.postmark.hasPassword} disabled={disabled() || !draft.postmark.enabled} help={credentialHelp(draft.postmark.hasPassword)} onInput={(password) => setDraft((next) => { next.postmark.password = password; })} />
						</div>
					</div>
					<div class="settings-provider-card">
						<SettingToggle label="Forward Email" help="Accept Forward Email bounce webhooks." checked={draft.forwardEmail.enabled} disabled={disabled() || !draft.enabled || !draft.webhooksEnabled} onChange={(enabled) => setDraft((next) => { next.forwardEmail.enabled = enabled; })} />
						<StoredSecretField label="API key" value={draft.forwardEmail.key} hasSaved={draft.forwardEmail.hasKey} disabled={disabled() || !draft.forwardEmail.enabled} help={credentialHelp(draft.forwardEmail.hasKey)} onInput={(key) => setDraft((next) => { next.forwardEmail.key = key; })} />
					</div>
					<div class="settings-provider-card">
						<SettingToggle label="Lettermint" help="Accept Lettermint bounce webhooks." checked={draft.lettermint.enabled} disabled={disabled() || !draft.enabled || !draft.webhooksEnabled} onChange={(enabled) => setDraft((next) => { next.lettermint.enabled = enabled; })} />
						<StoredSecretField label="API key" value={draft.lettermint.key} hasSaved={draft.lettermint.hasKey} disabled={disabled() || !draft.lettermint.enabled} help={credentialHelp(draft.lettermint.hasKey)} onInput={(key) => setDraft((next) => { next.lettermint.key = key; })} />
					</div>
				</div>
			</fieldset>

			<fieldset class="settings-card" disabled={disabled()}>
				<legend>POP bounce mailbox</legend>
				<p class="settings-note settings-note--flush">Listmonk processes at most one enabled mailbox. Additional saved mailbox records are preserved and can be enabled here one at a time.</p>
				<For each={mailboxes()} keyed={(mailbox) => mailbox.uuid}>{(mailbox, index) => (
					<fieldset class="settings-provider-card">
						<legend>Mailbox {index() + 1}</legend>
						<SettingToggle label="Enable this mailbox" help="Enabling it disables any other mailbox in this draft." checked={mailbox().enabled} disabled={disabled() || !draft.enabled} onChange={(value) => updateMailbox(index(), { enabled: value })} />
						<div class="smtp-fields">
							<InputField fieldClass="smtp-wide" label="Host" value={mailbox().host} maxlength="255" disabled={disabled()} onInput={(event) => updateMailbox(index(), { host: event.currentTarget.value })} />
							<InputField label="Port" type="number" min="1" max="65535" value={mailbox().port} disabled={disabled()} onInput={(event) => updateMailbox(index(), { port: Number(event.currentTarget.value) })} />
							<SelectField label="Authentication" value={mailbox().authProtocol} disabled={disabled()} onChange={(event) => updateMailbox(index(), { authProtocol: event.currentTarget.value as MailboxDraft['authProtocol'] })}>
									<option value="userpass">Username and password</option>
									<option value="none">None</option>
							</SelectField>
							<InputField label="Username" value={mailbox().username} maxlength="1000" disabled={disabled() || mailbox().authProtocol === 'none'} onInput={(event) => updateMailbox(index(), { username: event.currentTarget.value })} />
							<StoredSecretField label="Password" value={mailbox().password} hasSaved={mailbox().hasPassword} disabled={disabled() || mailbox().authProtocol === 'none'} help={credentialHelp(mailbox().hasPassword)} onInput={(password) => updateMailbox(index(), { password })} />
							<InputField label="Scan interval" help="At least one minute, for example 15m or 1h." value={mailbox().scanInterval} pattern={GO_DURATION_HTML_PATTERN} maxlength="64" disabled={disabled()} onInput={(event) => updateMailbox(index(), { scanInterval: event.currentTarget.value })} />
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
