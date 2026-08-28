import { For, Show, createSignal, untrack } from 'solid-js';
import { GO_DURATION_HTML_PATTERN, type SaveEmailSettingsCommand, type SmtpServer, type TestSmtpCommand } from './contracts';

type SmtpDraft = SmtpServer & { password: string; passwordChanged: boolean; testRecipient: string };

function editableServer(draft: SmtpDraft) {
	return {
		uuid: draft.uuid,
		name: draft.name,
		enabled: draft.enabled,
		host: draft.host,
		port: draft.port,
		authProtocol: draft.authProtocol,
		username: draft.username,
		helloHostname: draft.helloHostname,
		maxConnections: draft.maxConnections,
		maxMessageRetries: draft.maxMessageRetries,
		messageRetryDelay: draft.messageRetryDelay,
		idleTimeout: draft.idleTimeout,
		waitTimeout: draft.waitTimeout,
		tlsType: draft.tlsType,
		tlsSkipVerify: draft.tlsSkipVerify,
		fromAddresses: [...draft.fromAddresses],
	};
}

function newServer(): SmtpDraft {
	return {
		uuid: crypto.randomUUID(),
		name: '',
		enabled: true,
		host: '',
		port: 587,
		authProtocol: 'none',
		username: '',
		password: '',
		passwordChanged: false,
		hasPassword: false,
		helloHostname: '',
		maxConnections: 10,
		maxMessageRetries: 2,
		messageRetryDelay: '10ms',
		idleTimeout: '15s',
		waitTimeout: '5s',
		tlsType: 'STARTTLS',
		tlsSkipVerify: false,
		fromAddresses: [],
		testRecipient: '',
	};
}

export function EmailSettingsForm(props: {
	initial: SmtpServer[];
	canEdit: boolean;
	pending: boolean;
	testingUuid: string;
	error: string;
	onSubmit: (command: SaveEmailSettingsCommand) => Promise<boolean>;
	onTest: (command: TestSmtpCommand) => void;
}) {
	const initial = untrack(() => props.initial);
	const [servers, setServers] = createSignal<SmtpDraft[]>(initial.map((server) => ({
		...server,
		password: '',
		passwordChanged: false,
		testRecipient: '',
	})));
	const [localError, setLocalError] = createSignal('');
	function updateServer(index: number, patch: Partial<SmtpDraft>): void {
		setServers((current) => current.map((server, itemIndex) => itemIndex === index ? { ...server, ...patch } : server));
	}

	async function submit(): Promise<void> {
		setLocalError('');
		if (servers().length === 0) {
			setLocalError('Configure at least one SMTP server.');
			return;
		}
		const saved = await props.onSubmit({
			servers: servers().map((server) => ({
				...editableServer(server),
				password: server.passwordChanged ? server.password : null,
			})),
		});
		if (saved) {
			setServers((current) => current.map((server) => ({
				...server,
				hasPassword: server.hasPassword || (server.passwordChanged && server.password.length > 0),
				password: '',
				passwordChanged: false,
			})));
		}
	}

	function test(index: number): void {
		const draft = servers()[index];
		if (!draft) return;
		setLocalError('');
		if (draft.authProtocol !== 'none' && !draft.passwordChanged) {
			setLocalError('Re-enter this server’s SMTP password before testing. Saved passwords cannot be recovered from Listmonk.');
			return;
		}
		props.onTest({
			server: { ...editableServer(draft), password: draft.password },
			recipient: draft.testRecipient,
		});
	}

	return (
		<form class="smtp-settings-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
			<Show when={localError() || props.error}>{(message) => <p class="field-error" role="alert">{message()}</p>}</Show>
			<For each={servers()} keyed={(server) => server.uuid}>
				{(server, index) => {
					const fieldId = (field: string) => `smtp-${field}-${index()}`;
					return (
					<fieldset class="smtp-server-card" disabled={!props.canEdit || props.pending}>
						<legend>SMTP server {index() + 1}</legend>
						<div class="smtp-server-heading">
							<label class="smtp-check-field">
								<input type="checkbox" checked={server().enabled} onChange={(event) => updateServer(index(), { enabled: event.currentTarget.checked })} />
								<span>Enabled</span>
							</label>
							<Show when={props.canEdit && servers().length > 1}>
								<button class="button button--danger-secondary" type="button" onClick={() => setServers((current) => current.filter((_, itemIndex) => itemIndex !== index()))}>Remove</button>
							</Show>
						</div>
						<div class="smtp-fields">
							<label class="form-field smtp-wide"><span>Host</span><input value={server().host} maxlength="255" required onInput={(event) => updateServer(index(), { host: event.currentTarget.value })} /></label>
							<label class="form-field"><span>Port</span><input type="number" min="1" max="65535" value={server().port} required onInput={(event) => updateServer(index(), { port: event.currentTarget.valueAsNumber })} /></label>
							<label class="form-field"><span>Authentication</span><select value={server().authProtocol} onChange={(event) => updateServer(index(), { authProtocol: event.currentTarget.value as SmtpDraft['authProtocol'] })}><option value="none">None</option><option value="login">LOGIN</option><option value="plain">PLAIN</option><option value="cram">CRAM-MD5</option></select></label>
							<label class="form-field"><span>Username</span><input value={server().username} maxlength="1000" disabled={!props.canEdit || props.pending || server().authProtocol === 'none'} onInput={(event) => updateServer(index(), { username: event.currentTarget.value })} /></label>
							<div class="form-field">
								<label for={fieldId('password')}>Password</label>
								<input id={fieldId('password')} aria-describedby={server().hasPassword && !server().passwordChanged ? fieldId('password-help') : undefined} type="password" value={server().password} maxlength="10000" disabled={!props.canEdit || props.pending || server().authProtocol === 'none'} placeholder={server().hasPassword && !server().passwordChanged ? 'Saved password' : undefined} onInput={(event) => updateServer(index(), { password: event.currentTarget.value, passwordChanged: true })} />
								<Show when={server().hasPassword && !server().passwordChanged}><small id={fieldId('password-help')}>Leave blank to keep the saved password. Re-enter it to run a test.</small></Show>
							</div>
							<label class="form-field"><span>TLS</span><select value={server().tlsType} onChange={(event) => updateServer(index(), { tlsType: event.currentTarget.value as SmtpDraft['tlsType'] })}><option value="none">Off</option><option value="STARTTLS">STARTTLS</option><option value="TLS">SSL/TLS</option></select></label>
							<label class="smtp-check-field smtp-align-end"><input type="checkbox" checked={server().tlsSkipVerify} disabled={!props.canEdit || props.pending || server().tlsType === 'none'} onChange={(event) => updateServer(index(), { tlsSkipVerify: event.currentTarget.checked })} /><span>Skip TLS certificate verification</span></label>
							<label class="form-field"><span>HELO hostname</span><input value={server().helloHostname} maxlength="255" onInput={(event) => updateServer(index(), { helloHostname: event.currentTarget.value })} /></label>
							<label class="form-field"><span>Connections</span><input type="number" min="1" max="10000" value={server().maxConnections} required onInput={(event) => updateServer(index(), { maxConnections: event.currentTarget.valueAsNumber })} /></label>
							<label class="form-field"><span>Message retries</span><input type="number" min="0" max="1000" value={server().maxMessageRetries} required onInput={(event) => updateServer(index(), { maxMessageRetries: event.currentTarget.valueAsNumber })} /></label>
							<label class="form-field"><span>Retry delay</span><input value={server().messageRetryDelay} pattern={GO_DURATION_HTML_PATTERN} maxlength="64" required onInput={(event) => updateServer(index(), { messageRetryDelay: event.currentTarget.value })} /></label>
							<label class="form-field"><span>Idle timeout</span><input value={server().idleTimeout} pattern={GO_DURATION_HTML_PATTERN} maxlength="64" required onInput={(event) => updateServer(index(), { idleTimeout: event.currentTarget.value })} /></label>
							<label class="form-field"><span>Pool wait timeout</span><input value={server().waitTimeout} pattern={GO_DURATION_HTML_PATTERN} maxlength="64" required onInput={(event) => updateServer(index(), { waitTimeout: event.currentTarget.value })} /></label>
							<div class="form-field">
								<label for={fieldId('name')}>Server name</label>
								<input id={fieldId('name')} aria-describedby={fieldId('name-help')} value={server().name} maxlength="100" placeholder="email-primary" onInput={(event) => updateServer(index(), { name: event.currentTarget.value })} />
								<small id={fieldId('name-help')}>Optional Listmonk messenger name.</small>
							</div>
							<div class="form-field smtp-wide">
								<label for={fieldId('from')}>From addresses or domains</label>
								<input id={fieldId('from')} aria-describedby={fieldId('from-help')} value={server().fromAddresses.join(', ')} maxlength="26000" placeholder="sender@example.org, example.org" onInput={(event) => updateServer(index(), { fromAddresses: event.currentTarget.value.split(',').map((value) => value.trim()).filter(Boolean) })} />
								<small id={fieldId('from-help')}>Optional comma-separated routing keys. Existing custom headers are retained but intentionally not editable here.</small>
							</div>
						</div>
						<Show when={props.canEdit}>
							<div class="smtp-test-row">
								<label class="form-field"><span>Test recipient</span><input type="email" value={server().testRecipient} maxlength="320" placeholder="you@example.org" onInput={(event) => updateServer(index(), { testRecipient: event.currentTarget.value })} /></label>
								<button class="button button--secondary" type="button" disabled={props.pending || props.testingUuid === server().uuid} onClick={() => test(index())}>{props.testingUuid === server().uuid ? 'Sending…' : 'Send test'}</button>
							</div>
						</Show>
					</fieldset>
					);
				}}
			</For>
			<Show when={props.canEdit}>
				<div class="form-actions smtp-actions">
					<button class="button button--secondary" type="button" disabled={props.pending} onClick={() => setServers((current) => [...current, newServer()])}>Add SMTP server</button>
					<button class="button" type="submit" disabled={props.pending}>{props.pending ? 'Saving…' : 'Save SMTP settings'}</button>
				</div>
			</Show>
		</form>
	);
}
