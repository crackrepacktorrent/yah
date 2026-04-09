import { For, Show, createMemo, createSignal, untrack } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';
import { Badge, Button, Card, Dialog, AlertDialog, FormField, Input, Select, Switch } from '~/components';
import { toastError } from '~/lib/utils';
import type { ListmonkSmtpConfig } from '~/server/listmonk';
import { testSmtpConnection } from '../../settings.server';
import type { TabProps } from '../email';

type SmtpDraft = ListmonkSmtpConfig & { _passwordChanged: boolean };

function emptySmtpServer(): SmtpDraft {
	return {
		uuid: crypto.randomUUID(),
		enabled: true,
		host: '',
		port: 587,
		auth_protocol: 'login',
		username: '',
		password: '',
		email_headers: [],
		hello_hostname: '',
		max_conns: 10,
		max_msg_retries: 2,
		idle_timeout: '15s',
		wait_timeout: '5s',
		tls_type: 'STARTTLS',
		tls_skip_verify: false,
		_passwordChanged: true,
	};
}

export function SmtpTab(props: TabProps) {
	const [servers, setServers] = createStore<SmtpDraft[]>(
		untrack(() =>
			(props.settings.smtp ?? []).map((s) => ({
				...structuredClone(s),
				uuid: s.uuid || crypto.randomUUID(),
				_passwordChanged: false,
			}))
		)
	);
	const [deleteIdx, setDeleteIdx] = createSignal<number | null>(null);
	const [saving, setSaving] = createSignal(false);
	const [testIdx, setTestIdx] = createSignal<number | null>(null);
	const [testEmail, setTestEmail] = createSignal('');
	const [testing, setTesting] = createSignal(false);

	function addServer() {
		setServers(servers.length, emptySmtpServer());
	}

	function handleDelete() {
		const i = deleteIdx();
		if (i === null) return;
		setServers((prev) => prev.filter((_, idx) => idx !== i));
		setDeleteIdx(null);
	}

	function openTest(idx: number) {
		const s = servers[idx];
		if (s && !s._passwordChanged && s.auth_protocol !== 'none') {
			toast.error('Enter the SMTP password before testing.');
			setServers(idx, { password: '', _passwordChanged: true });
			// Focus the password input in this card
			const el = document.querySelectorAll<HTMLInputElement>('.smtp-fields input[type="password"]')[idx];
			el?.focus();
			return;
		}
		setTestIdx(idx);
		setTestEmail('');
	}

	async function handleTest() {
		const i = testIdx();
		if (i === null) return;
		const s = servers[i];
		if (!s) return;

		const email = testEmail().trim();
		if (!email) {
			toast.error('Enter an email address.');
			return;
		}

		setTesting(true);
		try {
			await testSmtpConnection({
				uuid: s.uuid,
				enabled: s.enabled,
				host: s.host,
				port: s.port,
				auth_protocol: s.auth_protocol,
				username: s.username,
				password: s._passwordChanged ? s.password : '',
				email_headers: s.email_headers,
				hello_hostname: s.hello_hostname,
				max_conns: s.max_conns,
				max_msg_retries: s.max_msg_retries,
				idle_timeout: s.idle_timeout,
				wait_timeout: s.wait_timeout,
				tls_type: s.tls_type,
				tls_skip_verify: s.tls_skip_verify,
				email,
			});
			toast.success('Test email sent successfully.');
			setTestIdx(null);
		} catch (err) {
			toastError(err, 'SMTP test failed.');
		} finally {
			setTesting(false);
		}
	}

	async function handleSave() {
		if (servers.some((s) => !s.host.trim())) {
			toast.error('All SMTP servers must have a host.');
			return;
		}
		const payload: ListmonkSmtpConfig[] = servers.map((s) => ({
			uuid: s.uuid,
			enabled: s.enabled,
			host: s.host,
			port: s.port,
			auth_protocol: s.auth_protocol,
			username: s.username,
			password: s._passwordChanged ? s.password : '',
			email_headers: s.email_headers,
			hello_hostname: s.hello_hostname,
			max_conns: s.max_conns,
			max_msg_retries: s.max_msg_retries,
			idle_timeout: s.idle_timeout,
			wait_timeout: s.wait_timeout,
			tls_type: s.tls_type,
			tls_skip_verify: s.tls_skip_verify,
		}));
		setSaving(true);
		try {
			await props.onSave({ smtp: payload });
		} finally {
			setSaving(false);
		}
	}

	return (
		<div class="smtp-list">
			<For each={servers}>
				{(server, i) => (
					<SmtpServerCard
						server={server}
						canEdit={props.canEdit}
						canDelete={servers.length > 1}
						onUpdate={(patch) => setServers(i(), patch)}
						onDelete={() => setDeleteIdx(i())}
						onTest={() => openTest(i())}
					/>
				)}
			</For>

			<Show when={servers.length === 0}>
				<p class="smtp-empty">No SMTP servers configured.</p>
			</Show>

			<Show when={props.canEdit}>
				<div class="smtp-actions">
					<Button variant="secondary" onClick={addServer}>+ Add Server</Button>
					<Show when={servers.length > 0}>
						<Button onClick={handleSave} disabled={saving()}>{saving() ? 'Saving…' : 'Save'}</Button>
					</Show>
				</div>
			</Show>

			<AlertDialog
				open={deleteIdx() !== null}
				onOpenChange={(open) => { if (!open) setDeleteIdx(null); }}
				title="Delete SMTP Server"
				description="Remove this SMTP server? You'll need to save for changes to take effect."
				confirmLabel="Delete"
				onconfirm={handleDelete}
			/>

			<Dialog
				open={testIdx() !== null}
				onOpenChange={(open) => { if (!open) setTestIdx(null); }}
				title="Send Test Email"
				maxWidth="420px"
				footer={
					<div class="tab-actions">
						<Button variant="secondary" onClick={() => setTestIdx(null)} disabled={testing()}>Cancel</Button>
						<Button onClick={handleTest} disabled={testing()}>{testing() ? 'Sending…' : 'Send Test'}</Button>
					</div>
				}
			>
				<FormField label="Recipient email" hint="A test email will be sent to this address using the current SMTP configuration.">
					<Input
						type="email"
						value={testEmail()}
						onInput={(e) => setTestEmail(e.currentTarget.value)}
						placeholder="test@example.com"
						autofocus
					/>
				</FormField>
			</Dialog>
		</div>
	);
}

// ─── SMTP Server Card ─────────────────────────────────────────────────────────

const smtpPresets: Record<string, Partial<ListmonkSmtpConfig>> = {
	Gmail: { host: 'smtp.gmail.com', port: 465, auth_protocol: 'login', tls_type: 'TLS' },
	'Amazon SES': { host: 'email-smtp.us-east-1.amazonaws.com', port: 465, auth_protocol: 'login', tls_type: 'TLS' },
	Mailgun: { host: 'smtp.mailgun.org', port: 465, auth_protocol: 'login', tls_type: 'TLS' },
	SendGrid: { host: 'smtp.sendgrid.net', port: 465, auth_protocol: 'login', tls_type: 'TLS' },
	Postmark: { host: 'smtp.postmarkapp.com', port: 587, auth_protocol: 'cram', tls_type: 'STARTTLS' },
	'Forward Email': { host: 'smtp.forwardemail.net', port: 465, auth_protocol: 'login', tls_type: 'TLS' },
};

const authOptions = [
	{ value: 'login', label: 'LOGIN' },
	{ value: 'cram', label: 'CRAM' },
	{ value: 'plain', label: 'PLAIN' },
	{ value: 'none', label: 'None' },
];

const tlsOptions = [
	{ value: 'none', label: 'Off' },
	{ value: 'STARTTLS', label: 'STARTTLS' },
	{ value: 'TLS', label: 'SSL/TLS' },
];

function isDummy(pwd: string): boolean {
	return !pwd || pwd.split('').every((c) => c === '\u2022');
}

type SmtpCardProps = {
	server: SmtpDraft;
	canEdit: boolean;
	canDelete: boolean;
	onUpdate: (patch: Partial<SmtpDraft>) => void;
	onDelete: () => void;
	onTest: () => void;
};

function SmtpServerCard(props: SmtpCardProps) {
	function applyPreset(name: string) {
		const p = smtpPresets[name];
		if (!p) return;
		props.onUpdate({ ...p, username: '', password: '', _passwordChanged: true });
	}

	const isMasked = createMemo(() => !props.server._passwordChanged && isDummy(props.server.password));

	return (
		<Card variant="flat">
			<div class="smtp-header">
				<div class="smtp-title">
					<Switch
						label="Enabled"
						checked={props.server.enabled}
						onChange={(v) => props.onUpdate({ enabled: v })}
						disabled={!props.canEdit}
					/>
					<Show when={props.server.host}>
						<Badge variant={props.server.enabled ? 'success' : 'default'}>
							{props.server.host}:{props.server.port}
						</Badge>
					</Show>
				</div>
				<div class="smtp-header-actions">
					<Show when={props.canEdit}>
						<Button variant="secondary" onClick={props.onTest}>Test</Button>
					</Show>
					<Show when={props.canEdit && props.canDelete}>
						<Button variant="danger-outline" onClick={props.onDelete}>Delete</Button>
					</Show>
				</div>
			</div>

			<div class="smtp-fields">
				<div class="form-row">
					<FormField label="Host" hint="SMTP server's host address.">
						<Input
							value={props.server.host}
							onInput={(e) => props.onUpdate({ host: e.currentTarget.value })}
							disabled={!props.canEdit}
							placeholder="smtp.yoursite.com"
						/>
					</FormField>
					<FormField label="Port" hint="SMTP server's port.">
						<Input
							type="number"
							value={String(props.server.port)}
							onInput={(e) => props.onUpdate({ port: parseInt(e.currentTarget.value, 10) || props.server.port })}
							disabled={!props.canEdit}
						/>
					</FormField>
				</div>

				<div class="form-row-3">
					<FormField label="Auth protocol">
						<Select
							value={props.server.auth_protocol}
							onValueChange={(v) => props.onUpdate({ auth_protocol: v as ListmonkSmtpConfig['auth_protocol'] })}
							options={authOptions}
							disabled={!props.canEdit}
						/>
					</FormField>
					<Show when={props.server.auth_protocol !== 'none'}>
						<FormField label="Username">
							<Input
								value={props.server.username}
								onInput={(e) => props.onUpdate({ username: e.currentTarget.value })}
								disabled={!props.canEdit}
								placeholder="mysmtp"
							/>
						</FormField>
						<FormField label="Password" hint={isMasked() ? 'Enter to change.' : undefined}>
							<Input
								type="password"
								value={isMasked() ? '' : props.server.password}
								onInput={(e) => props.onUpdate({ password: e.currentTarget.value, _passwordChanged: true })}
								disabled={!props.canEdit}
								placeholder={isMasked() ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : ''}
							/>
						</FormField>
					</Show>
				</div>

				<div class="presets">
					<For each={Object.keys(smtpPresets)}>
						{(name) => (
							<button type="button" class="preset-btn" onClick={() => applyPreset(name)} disabled={!props.canEdit}>
								{name}
							</button>
						)}
					</For>
				</div>

				<div class="form-row">
					<FormField label="HELO hostname" hint="Optional. Some SMTP servers require a FQDN. By default, HELOs go with 'localhost'.">
						<Input
							value={props.server.hello_hostname}
							onInput={(e) => props.onUpdate({ hello_hostname: e.currentTarget.value })}
							disabled={!props.canEdit}
						/>
					</FormField>
					<FormField label="TLS" hint="TLS/SSL encryption. STARTTLS is commonly used.">
						<Select
							value={props.server.tls_type}
							onValueChange={(v) => props.onUpdate({ tls_type: v as ListmonkSmtpConfig['tls_type'] })}
							options={tlsOptions}
							disabled={!props.canEdit}
						/>
					</FormField>
				</div>

				<Switch
					label="Skip TLS verification"
					hint="Skip hostname check on the TLS certificate."
					checked={props.server.tls_skip_verify}
					onChange={(v) => props.onUpdate({ tls_skip_verify: v })}
					disabled={!props.canEdit}
				/>

				<div class="form-row-4">
					<FormField label="Max. connections" hint="Maximum concurrent connections to the server.">
						<Input
							type="number"
							value={String(props.server.max_conns)}
							onInput={(e) => props.onUpdate({ max_conns: parseInt(e.currentTarget.value, 10) || props.server.max_conns })}
							disabled={!props.canEdit}
						/>
					</FormField>
					<FormField label="Retries" hint="Number of times to retry when a message fails.">
						<Input
							type="number"
							value={String(props.server.max_msg_retries)}
							onInput={(e) => props.onUpdate({ max_msg_retries: parseInt(e.currentTarget.value, 10) || props.server.max_msg_retries })}
							disabled={!props.canEdit}
						/>
					</FormField>
					<FormField label="Idle timeout" hint="Time to wait before closing idle connections (s = second, m = minute).">
						<Input
							value={props.server.idle_timeout}
							onInput={(e) => props.onUpdate({ idle_timeout: e.currentTarget.value })}
							disabled={!props.canEdit}
							placeholder="15s"
						/>
					</FormField>
					<FormField label="Wait timeout" hint="Time to wait for new activity on a connection (s = second, m = minute).">
						<Input
							value={props.server.wait_timeout}
							onInput={(e) => props.onUpdate({ wait_timeout: e.currentTarget.value })}
							disabled={!props.canEdit}
							placeholder="5s"
						/>
					</FormField>
				</div>
			</div>
		</Card>
	);
}
