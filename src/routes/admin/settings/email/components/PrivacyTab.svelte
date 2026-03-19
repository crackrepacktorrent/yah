<script lang="ts">
	import { Button, Switch, Section, TagInput } from '$lib/components/admin';
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

	let individualTracking = $state(settings['privacy.individual_tracking']);
	let unsubscribeHeader = $state(settings['privacy.unsubscribe_header']);
	let allowBlocklist = $state(settings['privacy.allow_blocklist']);
	let allowPreferences = $state(settings['privacy.allow_preferences']);
	let allowExport = $state(settings['privacy.allow_export']);
	let allowWipe = $state(settings['privacy.allow_wipe']);
	let recordOptinIp = $state(settings['privacy.record_optin_ip']);
	let domainBlocklist = $state<string[]>(settings['privacy.domain_blocklist'] ?? []);
	let domainAllowlist = $state<string[]>(settings['privacy.domain_allowlist'] ?? []);

	let saving = $state(false);

	async function handleSave() {
		saving = true;
		try {
			await onsave({
				'privacy.individual_tracking': individualTracking,
				'privacy.unsubscribe_header': unsubscribeHeader,
				'privacy.allow_blocklist': allowBlocklist,
				'privacy.allow_preferences': allowPreferences,
				'privacy.allow_export': allowExport,
				'privacy.allow_wipe': allowWipe,
				'privacy.record_optin_ip': recordOptinIp,
				'privacy.domain_blocklist': domainBlocklist,
				'privacy.domain_allowlist': domainAllowlist,
			});
		} finally {
			saving = false;
		}
	}
</script>

<div class="settings-sections">
	<Section title="Tracking">
		<div class="form-fields">
			<Switch bind:checked={individualTracking} label="Individual subscriber tracking" disabled={!canEdit} />
			<p class="settings-hint">Track subscriber-level campaign views and clicks. When disabled, tracking continues without being linked to individuals.</p>

			<Switch bind:checked={unsubscribeHeader} label="Include List-Unsubscribe header" disabled={!canEdit} />
			<Switch bind:checked={recordOptinIp} label="Record opt-in IP address" disabled={!canEdit} />
		</div>
	</Section>

	<Section title="Subscriber self-service">
		<div class="form-fields">
			<Switch bind:checked={allowBlocklist} label="Allow blocklisting" disabled={!canEdit} />
			<Switch bind:checked={allowPreferences} label="Allow preference changes" disabled={!canEdit} />
			<Switch bind:checked={allowExport} label="Allow data export" disabled={!canEdit} />
			<Switch bind:checked={allowWipe} label="Allow data wipe" disabled={!canEdit} />
		</div>
	</Section>

	<Section title="Domain lists">
		<div class="form-row">
			<div class="domain-col">
				<span class="domain-label">Blocklist</span>
				<p class="settings-hint">Subscribers with these email domains are blocked from subscribing.</p>
				<TagInput bind:tags={domainBlocklist} disabled={!canEdit} placeholder="example.com" />
			</div>
			<div class="domain-col">
				<span class="domain-label">Allowlist</span>
				<p class="settings-hint">If set, only these email domains are allowed to subscribe.</p>
				<TagInput bind:tags={domainAllowlist} disabled={!canEdit} placeholder="yourcompany.com" />
			</div>
		</div>
	</Section>

	{#if canEdit}
		<div class="tab-actions">
			<Button variant="primary" onclick={handleSave} disabled={saving}>
				{saving ? 'Saving...' : 'Save'}
			</Button>
		</div>
	{/if}
</div>

<style>
	.domain-col {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.domain-label {
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--color-foreground);
	}
</style>
