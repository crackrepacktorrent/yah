<script lang="ts">
	import { Badge, Button, Card, FormField, Input, Select, Switch } from '$lib/components/admin';
	import { useForm } from '$lib/utils/use-form.svelte';
	import * as v from 'valibot';
	import type { ListmonkSmtpConfig } from '$lib/server/listmonk';

	let {
		initial,
		canEdit,
		canDelete,
		ondelete,
		getValues = $bindable(),
	}: {
		initial: ListmonkSmtpConfig;
		canEdit: boolean;
		canDelete: boolean;
		ondelete: () => void;
		getValues?: () => { values: ListmonkSmtpConfig; valid: boolean };
	} = $props();

	const schema = v.object({
		enabled: v.boolean(),
		host: v.pipe(v.string(), v.nonEmpty('Host is required')),
		port: v.pipe(v.number(), v.minValue(1), v.maxValue(65535)),
		auth_protocol: v.picklist(['login', 'cram', 'plain', 'none']),
		username: v.string(),
		password: v.string(),
		hello_hostname: v.string(),
		max_conns: v.pipe(v.number(), v.minValue(1)),
		max_msg_retries: v.pipe(v.number(), v.minValue(1)),
		idle_timeout: v.pipe(v.string(), v.nonEmpty()),
		wait_timeout: v.pipe(v.string(), v.nonEmpty()),
		tls_type: v.picklist(['TLS', 'STARTTLS', 'none']),
		tls_skip_verify: v.boolean(),
	});

	function isDummy(pwd: string): boolean {
		return !pwd || pwd.split('').every((c) => c === '•');
	}

	const isNew = !initial.host;
	let passwordChanged = $state(isNew);
	const uuid = initial.uuid;

	const form = useForm({
		enabled: initial.enabled,
		host: initial.host,
		port: initial.port,
		auth_protocol: initial.auth_protocol,
		username: initial.username,
		password: initial.password,
		hello_hostname: initial.hello_hostname,
		max_conns: initial.max_conns,
		max_msg_retries: initial.max_msg_retries,
		idle_timeout: initial.idle_timeout,
		wait_timeout: initial.wait_timeout,
		tls_type: initial.tls_type,
		tls_skip_verify: initial.tls_skip_verify,
	}, schema);

	// Expose a getter so the parent can collect values on save
	getValues = () => {
		const valid = form.validate();
		const v = form.values;
		return {
			valid,
			values: {
				...v,
				uuid,
				password: passwordChanged ? v.password : '',
				email_headers: initial.email_headers,
			} as ListmonkSmtpConfig,
		};
	};

	const presets: Record<string, Partial<typeof form.values>> = {
		Gmail: { host: 'smtp.gmail.com', port: 465, auth_protocol: 'login', tls_type: 'TLS' },
		'Amazon SES': { host: 'email-smtp.us-east-1.amazonaws.com', port: 465, auth_protocol: 'login', tls_type: 'TLS' },
		Mailgun: { host: 'smtp.mailgun.org', port: 465, auth_protocol: 'login', tls_type: 'TLS' },
		SendGrid: { host: 'smtp.sendgrid.net', port: 465, auth_protocol: 'login', tls_type: 'TLS' },
		Postmark: { host: 'smtp.postmarkapp.com', port: 587, auth_protocol: 'cram', tls_type: 'STARTTLS' },
		'Forward Email': { host: 'smtp.forwardemail.net', port: 465, auth_protocol: 'login', tls_type: 'TLS' },
	};

	function applyPreset(name: string) {
		const p = presets[name];
		Object.assign(form.values, p, { username: '', password: '' });
		passwordChanged = true;
	}

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
</script>

<Card>
	<div class="smtp-header">
		<div class="smtp-title">
			<Switch bind:checked={form.values.enabled} label="Enabled" disabled={!canEdit} />
			{#if form.values.host}
				<Badge variant={form.values.enabled ? 'success' : 'default'}>{form.values.host}:{form.values.port}</Badge>
			{/if}
		</div>
		{#if canEdit && canDelete}
			<Button variant="danger-outline" onclick={ondelete}>Delete</Button>
		{/if}
	</div>

	<div class="smtp-fields">
		<div class="cols cols-2">
			<FormField label="Host" hint="SMTP server's host address." error={form.fieldError('host')}>
				<Input bind:value={form.values.host} onblur={() => form.touch('host')} disabled={!canEdit} placeholder="smtp.yoursite.com" />
			</FormField>
			<FormField label="Port" hint="SMTP server's port.">
				<Input type="number" bind:value={form.values.port} disabled={!canEdit} />
			</FormField>
		</div>

		<div class="cols cols-3">
			<FormField label="Auth protocol">
				<Select bind:value={form.values.auth_protocol} options={authOptions} disabled={!canEdit} />
			</FormField>
			{#if form.values.auth_protocol !== 'none'}
				<FormField label="Username">
					<Input bind:value={form.values.username} disabled={!canEdit} placeholder="mysmtp" />
				</FormField>
				<FormField label="Password">
					{@const masked = !passwordChanged && isDummy(initial.password)}
					<Input
						type="password"
						value={masked ? '' : form.values.password}
						oninput={(e: Event) => { passwordChanged = true; form.values.password = (e.target as HTMLInputElement).value; }}
						disabled={!canEdit}
						placeholder={masked ? 'Enter to change' : ''}
					/>
				</FormField>
			{/if}
		</div>

		<div class="presets">
			{#each Object.keys(presets) as name}
				<button type="button" class="preset-btn" onclick={() => applyPreset(name)} disabled={!canEdit}>{name}</button>
			{/each}
		</div>

		<div class="cols cols-2">
			<FormField label="HELO hostname" hint="Optional. Some SMTP servers require a FQDN. By default, HELLOs go with 'localhost'.">
				<Input bind:value={form.values.hello_hostname} disabled={!canEdit} />
			</FormField>
			<FormField label="TLS" hint="TLS/SSL encryption. STARTTLS is commonly used.">
				<Select bind:value={form.values.tls_type} options={tlsOptions} disabled={!canEdit} />
			</FormField>
		</div>

		<Switch bind:checked={form.values.tls_skip_verify} label="Skip TLS verification" hint="Skip hostname check on the TLS certificate." disabled={!canEdit} />

		<div class="cols cols-4">
			<FormField label="Max. connections" hint="Maximum concurrent connections to the server.">
				<Input type="number" bind:value={form.values.max_conns} disabled={!canEdit} />
			</FormField>
			<FormField label="Retries" hint="Number of times to retry when a message fails.">
				<Input type="number" bind:value={form.values.max_msg_retries} disabled={!canEdit} />
			</FormField>
			<FormField label="Idle timeout" hint="Time to wait before closing idle connections (s for second, m for minute).">
				<Input bind:value={form.values.idle_timeout} disabled={!canEdit} placeholder="15s" />
			</FormField>
			<FormField label="Wait timeout" hint="Time to wait for new activity on a connection (s for second, m for minute).">
				<Input bind:value={form.values.wait_timeout} disabled={!canEdit} placeholder="5s" />
			</FormField>
		</div>
	</div>
</Card>

<style>
	.smtp-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--color-border-light);
	}

	.smtp-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.smtp-fields {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.cols {
		display: grid;
		gap: 0.75rem;
	}

	.cols-2 { grid-template-columns: 1fr 1fr; }
	.cols-3 { grid-template-columns: auto 1fr 1fr; }
	.cols-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }

	.presets {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.preset-btn {
		background: none;
		border: none;
		padding: 0;
		font-size: 0.8rem;
		color: var(--color-primary);
		cursor: pointer;
	}

	.preset-btn:hover:not(:disabled) {
		text-decoration: underline;
	}

	.preset-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.cols { grid-template-columns: 1fr; }
	}
</style>
