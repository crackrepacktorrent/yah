<script lang="ts">
	import { Button, ConfirmDialog } from '$lib/components/admin';
	import { toast } from 'svelte-sonner';
	import type { ListmonkSmtpConfig, ListmonkSettings } from '$lib/server/listmonk';
	import SmtpServerCard from './SmtpServerCard.svelte';

	let {
		settings,
		canEdit,
		onsave,
	}: {
		settings: ListmonkSettings;
		canEdit: boolean;
		onsave: (partial: Record<string, unknown>) => Promise<void>;
	} = $props();

	// Ensure every SMTP entry has a unique UUID (Listmonk can return empty strings)
	const smtpWithUuids = settings.smtp.map((s) => ({
		...structuredClone(s),
		uuid: s.uuid || crypto.randomUUID(),
	}));

	let serverUuids = $state<string[]>(smtpWithUuids.map((s) => s.uuid));
	let initialData = $state<Record<string, ListmonkSmtpConfig>>(
		Object.fromEntries(smtpWithUuids.map((s) => [s.uuid, s])),
	);

	// Each card binds its getValues function here
	let cardGetters = $state<Record<string, (() => { values: ListmonkSmtpConfig; valid: boolean }) | undefined>>({});

	let confirmDelete = $state(false);
	let deleteUuid = $state('');
	let saving = $state(false);

	function emptyServer(): ListmonkSmtpConfig {
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
		};
	}

	function addServer() {
		const s = emptyServer();
		initialData[s.uuid] = s;
		serverUuids = [...serverUuids, s.uuid];
	}

	function confirmDeleteServer(uuid: string) {
		deleteUuid = uuid;
		confirmDelete = true;
	}

	function handleDelete() {
		serverUuids = serverUuids.filter((u) => u !== deleteUuid);
		delete cardGetters[deleteUuid];
		delete initialData[deleteUuid];
	}

	async function handleSave() {
		// Collect and validate all cards
		const results = serverUuids.map((uuid) => {
			const getter = cardGetters[uuid];
			if (!getter) return null;
			return getter();
		});

		if (results.some((r) => !r || !r.valid)) {
			toast.error('Please fix validation errors before saving.');
			return;
		}

		const payload = results.filter(Boolean).map((r) => r!.values);

		saving = true;
		try {
			await onsave({ smtp: payload });
		} finally {
			saving = false;
		}
	}
</script>

<div class="smtp-list">
	{#each serverUuids as uuid (uuid)}
		<SmtpServerCard
			initial={initialData[uuid]}
			{canEdit}
			canDelete={serverUuids.length > 1}
			ondelete={() => confirmDeleteServer(uuid)}
			bind:getValues={cardGetters[uuid]}
		/>
	{/each}

	{#if serverUuids.length === 0}
		<p class="empty">No SMTP servers configured.</p>
	{/if}

	{#if canEdit}
		<div class="smtp-actions">
			<Button variant="secondary" onclick={addServer}>+ Add Server</Button>
			<Button variant="primary" onclick={handleSave} disabled={saving}>
				{saving ? 'Saving...' : 'Save'}
			</Button>
		</div>
	{/if}
</div>

<ConfirmDialog
	bind:open={confirmDelete}
	title="Delete SMTP Server"
	description="Remove this SMTP server? You'll need to save for changes to take effect."
	confirmLabel="Delete"
	onconfirm={handleDelete}
/>

<style>
	.smtp-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.smtp-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 0.25rem;
	}

	.empty {
		color: var(--color-muted);
		font-size: 0.9rem;
		text-align: center;
		padding: 2rem 0;
		margin: 0;
	}
</style>
