<script lang="ts">
	import { Breadcrumb, Card, Tabs, TabContent } from '$lib/components/admin';
	import { toast } from 'svelte-sonner';
	import { toastError } from '$lib/utils/toast-error';
	import { getEmailSettings, updateEmailSettings } from '../../settings.remote';
	import { getSession } from '../../session.remote';
	import { can } from '../../can';

	import GeneralTab from './components/GeneralTab.svelte';
	import SmtpTab from './components/SmtpTab.svelte';
	import PerformanceTab from './components/PerformanceTab.svelte';
	import BounceTab from './components/BounceTab.svelte';
	import PrivacyTab from './components/PrivacyTab.svelte';

	let [session, settings] = $derived(await Promise.all([getSession(), getEmailSettings()]));
	let canEdit = $derived(can(session, 'settings', 'edit'));

	let activeTab = $state('general');

	async function handleSave(partial: Record<string, unknown>) {
		try {
			// Listmonk requires the full settings object on PUT — merge changes into current state
			await updateEmailSettings({ ...settings, ...partial });
			toast.success('Settings saved.');
			getEmailSettings().refresh();
		} catch (err) {
			toastError(err, 'Failed to save settings.');
		}
	}
</script>

<Breadcrumb items={[{ label: 'Settings' }, { label: 'Email' }]} />

<h1>Email Settings</h1>

{#if settings}
{#key settings}
	<Card>
		<Tabs bind:value={activeTab} tabs={[
			{ value: 'general', label: 'General' },
			{ value: 'smtp', label: 'SMTP' },
			{ value: 'performance', label: 'Performance' },
			{ value: 'bounce', label: 'Bounces' },
			{ value: 'privacy', label: 'Privacy' },
		]}>
			<TabContent value="general">
				<GeneralTab {settings} {canEdit} onsave={handleSave} />
			</TabContent>
			<TabContent value="smtp">
				<SmtpTab {settings} {canEdit} onsave={handleSave} />
			</TabContent>
			<TabContent value="performance">
				<PerformanceTab {settings} {canEdit} onsave={handleSave} />
			</TabContent>
			<TabContent value="bounce">
				<BounceTab {settings} {canEdit} onsave={handleSave} />
			</TabContent>
			<TabContent value="privacy">
				<PrivacyTab {settings} {canEdit} onsave={handleSave} />
			</TabContent>
		</Tabs>
	</Card>
{/key}
{/if}
