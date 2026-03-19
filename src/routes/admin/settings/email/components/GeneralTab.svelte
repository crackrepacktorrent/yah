<script lang="ts">
	import { Button, FormField, Input, Switch, Section, TagInput } from '$lib/components/admin';
	import { useForm } from '$lib/utils/use-form.svelte';
	import * as v from 'valibot';
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

	const schema = v.object({
		siteName: v.pipe(v.string(), v.nonEmpty('Site name is required')),
		rootUrl: v.pipe(v.string(), v.nonEmpty('Root URL is required'), v.url('Must be a valid URL')),
		logoUrl: v.string(),
		faviconUrl: v.string(),
		fromEmail: v.string(),
		notifyEmails: v.array(v.string()),
		sendOptinConfirmation: v.boolean(),
		enablePublicSubPage: v.boolean(),
		enablePublicArchive: v.boolean(),
		enablePublicArchiveRss: v.boolean(),
		checkUpdates: v.boolean(),
	});

	const form = useForm({
		siteName: settings['app.site_name'],
		rootUrl: settings['app.root_url'],
		logoUrl: settings['app.logo_url'] ?? '',
		faviconUrl: settings['app.favicon_url'] ?? '',
		fromEmail: settings['app.from_email'],
		notifyEmails: settings['app.notify_emails'] ?? [],
		sendOptinConfirmation: settings['app.send_optin_confirmation'],
		enablePublicSubPage: settings['app.enable_public_subscription_page'],
		enablePublicArchive: settings['app.enable_public_archive'],
		enablePublicArchiveRss: settings['app.enable_public_archive_rss_content'],
		checkUpdates: settings['app.check_updates'],
	}, schema);

	let saving = $state(false);

	async function handleSave() {
		if (!form.validate()) return;
		saving = true;
		try {
			await onsave({
				'app.site_name': form.values.siteName,
				'app.root_url': form.values.rootUrl.replace(/\/+$/, ''),
				'app.logo_url': form.values.logoUrl,
				'app.favicon_url': form.values.faviconUrl,
				'app.from_email': form.values.fromEmail,
				'app.notify_emails': form.values.notifyEmails,
				'app.send_optin_confirmation': form.values.sendOptinConfirmation,
				'app.enable_public_subscription_page': form.values.enablePublicSubPage,
				'app.enable_public_archive': form.values.enablePublicArchive,
				'app.enable_public_archive_rss_content': form.values.enablePublicArchiveRss,
				'app.check_updates': form.values.checkUpdates,
			});
		} finally {
			saving = false;
		}
	}
</script>

<div class="settings-sections">
	<Section title="Site identity">
		<div class="form-fields">
			<FormField label="Site name" error={form.fieldError('siteName')}>
				<Input bind:value={form.values.siteName} onblur={() => form.touch('siteName')} disabled={!canEdit} />
			</FormField>

			<FormField label="Root URL" hint="Public URL of the installation (no trailing slash)." error={form.fieldError('rootUrl')}>
				<Input bind:value={form.values.rootUrl} onblur={() => form.touch('rootUrl')} disabled={!canEdit} placeholder="https://listmonk.yoursite.com" />
			</FormField>

			<div class="form-row">
				<FormField label="Logo URL" hint="Optional. Full URL to logo shown on public pages.">
					<Input bind:value={form.values.logoUrl} disabled={!canEdit} placeholder="https://yoursite.com/logo.png" />
				</FormField>

				<FormField label="Favicon URL" hint="Optional. Full URL to favicon shown on public pages.">
					<Input bind:value={form.values.faviconUrl} disabled={!canEdit} placeholder="https://yoursite.com/favicon.png" />
				</FormField>
			</div>
		</div>
	</Section>

	<Section title="Email defaults">
		<div class="form-fields">
			<FormField label="Default from email" hint="Default from address on outgoing campaign emails. Can be changed per campaign.">
				<Input bind:value={form.values.fromEmail} disabled={!canEdit} placeholder="Listmonk <noreply@yoursite.com>" />
			</FormField>

			<FormField label="Admin notification emails" hint="Receives import updates, campaign completion, failures.">
				<TagInput bind:tags={form.values.notifyEmails} disabled={!canEdit} placeholder="Add email..." />
			</FormField>

			<Switch bind:checked={form.values.sendOptinConfirmation} label="Send opt-in confirmation" hint="Send an opt-in confirmation email when subscribers sign up or are added by an admin." disabled={!canEdit} />
		</div>
	</Section>

	<Section title="Public pages">
		<div class="form-fields">
			<Switch bind:checked={form.values.enablePublicSubPage} label="Enable public subscription page" hint="Show a public page with all public lists for people to subscribe." disabled={!canEdit} />
			<Switch bind:checked={form.values.enablePublicArchive} label="Enable public mailing list archive" hint="Publish campaigns with archiving enabled on the public website." disabled={!canEdit} />
			{#if form.values.enablePublicArchive}
				<Switch bind:checked={form.values.enablePublicArchiveRss} label="Show full content in RSS feed" hint="If disabled, only the title and link elements are shown." disabled={!canEdit} />
			{/if}
		</div>
	</Section>

	<Section title="Updates">
		<Switch bind:checked={form.values.checkUpdates} label="Check for updates" hint="Periodically check for new app releases and notify." disabled={!canEdit} />
	</Section>

	{#if canEdit}
		<div class="tab-actions">
			<Button variant="primary" onclick={handleSave} disabled={saving}>
				{saving ? 'Saving...' : 'Save'}
			</Button>
		</div>
	{/if}
</div>

