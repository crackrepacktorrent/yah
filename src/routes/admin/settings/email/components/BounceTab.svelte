<script lang="ts">
	import { Button, FormField, Input, Switch, Select, Section } from '$lib/components/admin';
	import { toast } from 'svelte-sonner';
	import type { ListmonkSettings } from '$lib/server/listmonk';

	let {
		settings,
		canEdit,
		onsave,
	}: {
		settings: ListmonkSettings;
		canEdit: boolean;
		onsave: (partial: Record<string, unknown>) => Promise<void>;
	} = $props();

	let enabled = $state(settings['bounce.enabled']);
	let webhooksEnabled = $state(settings['bounce.webhooks_enabled']);
	let softCount = $state(settings['bounce.actions'].soft.count);
	let softAction = $state<string>(settings['bounce.actions'].soft.action);
	let hardCount = $state(settings['bounce.actions'].hard.count);
	let hardAction = $state<string>(settings['bounce.actions'].hard.action);
	let complaintCount = $state(settings['bounce.actions'].complaint.count);
	let complaintAction = $state<string>(settings['bounce.actions'].complaint.action);

	let sesEnabled = $state(settings['bounce.ses_enabled']);
	let sendgridEnabled = $state(settings['bounce.sendgrid_enabled']);
	let sendgridKey = $state(settings['bounce.sendgrid_key'] ?? '');
	let postmarkEnabled = $state(settings['bounce.postmark']?.enabled ?? false);
	let postmarkUsername = $state(settings['bounce.postmark']?.username ?? '');
	let postmarkPassword = $state(settings['bounce.postmark']?.password ?? '');
	let forwardemailEnabled = $state(settings['bounce.forwardemail']?.enabled ?? false);
	let forwardemailKey = $state(settings['bounce.forwardemail']?.key ?? '');

	const actionOptions = [
		{ value: 'none', label: 'None' },
		{ value: 'blocklist', label: 'Blocklist' },
		{ value: 'delete', label: 'Delete' },
	];

	let saving = $state(false);

	async function handleSave() {
		if (enabled && [softCount, hardCount, complaintCount].some((c) => typeof c !== 'number' || c < 1)) {
			toast.error('Bounce counts must be at least 1.');
			return;
		}
		saving = true;
		try {
			await onsave({
				'bounce.enabled': enabled,
				'bounce.webhooks_enabled': webhooksEnabled,
				'bounce.actions': {
					soft: { count: softCount, action: softAction },
					hard: { count: hardCount, action: hardAction },
					complaint: { count: complaintCount, action: complaintAction },
				},
				'bounce.ses_enabled': sesEnabled,
				'bounce.sendgrid_enabled': sendgridEnabled,
				'bounce.sendgrid_key': sendgridKey,
				'bounce.postmark': { enabled: postmarkEnabled, username: postmarkUsername, password: postmarkPassword },
				'bounce.forwardemail': { enabled: forwardemailEnabled, key: forwardemailKey },
			});
		} finally {
			saving = false;
		}
	}
</script>

<div class="settings-sections">
	<Section title="Processing">
		<div class="form-fields">
			<Switch bind:checked={enabled} label="Enable bounce processing" disabled={!canEdit} />
		</div>
	</Section>

	{#if enabled}
		<Section title="Actions">
			<div class="form-fields">
				<p class="settings-hint">Configure what happens when a subscriber accumulates bounces.</p>
				<div class="bounce-grid">
					{#each [
						{ label: 'Soft', count: softCount, action: softAction, setCount: (v: number) => softCount = v, setAction: (v: string) => softAction = v },
						{ label: 'Hard', count: hardCount, action: hardAction, setCount: (v: number) => hardCount = v, setAction: (v: string) => hardAction = v },
						{ label: 'Complaint', count: complaintCount, action: complaintAction, setCount: (v: number) => complaintCount = v, setAction: (v: string) => complaintAction = v },
					] as item}
						<div class="bounce-row">
							<span class="bounce-type">{item.label}</span>
							<FormField label="Count">
								<Input type="number" bind:value={item.count} disabled={!canEdit} />
							</FormField>
							<FormField label="Action">
								<Select value={item.action} onValueChange={item.setAction} options={actionOptions} disabled={!canEdit} />
							</FormField>
						</div>
					{/each}
				</div>
			</div>
		</Section>

		<Section title="Webhook providers">
			<div class="form-fields">
				<Switch bind:checked={webhooksEnabled} label="Enable bounce webhooks" disabled={!canEdit} />

				{#if webhooksEnabled}
					<Switch bind:checked={sesEnabled} label="Amazon SES" disabled={!canEdit} />

					<div class="provider-row">
						<Switch bind:checked={sendgridEnabled} label="SendGrid" disabled={!canEdit} />
						{#if sendgridEnabled}
							<FormField label="API Key">
								<Input type="password" bind:value={sendgridKey} disabled={!canEdit} placeholder="SG.xxxx" />
							</FormField>
						{/if}
					</div>

					<div class="provider-row">
						<Switch bind:checked={postmarkEnabled} label="Postmark" disabled={!canEdit} />
						{#if postmarkEnabled}
							<div class="form-row">
								<FormField label="Username">
									<Input bind:value={postmarkUsername} disabled={!canEdit} />
								</FormField>
								<FormField label="Password">
									<Input type="password" bind:value={postmarkPassword} disabled={!canEdit} />
								</FormField>
							</div>
						{/if}
					</div>

					<div class="provider-row">
						<Switch bind:checked={forwardemailEnabled} label="Forward Email" disabled={!canEdit} />
						{#if forwardemailEnabled}
							<FormField label="API Key">
								<Input type="password" bind:value={forwardemailKey} disabled={!canEdit} />
							</FormField>
						{/if}
					</div>
				{/if}
			</div>
		</Section>
	{/if}

	{#if canEdit}
		<div class="tab-actions">
			<Button variant="primary" onclick={handleSave} disabled={saving}>
				{saving ? 'Saving...' : 'Save'}
			</Button>
		</div>
	{/if}
</div>

<style>
	.bounce-grid {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.bounce-row {
		display: grid;
		grid-template-columns: 100px 1fr 1fr;
		gap: 0.75rem;
		align-items: end;
	}

	.bounce-type {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--color-foreground);
		padding-bottom: 0.6rem;
	}

	.provider-row {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	@media (max-width: 640px) {
		.bounce-row {
			grid-template-columns: 1fr;
		}
	}
</style>
