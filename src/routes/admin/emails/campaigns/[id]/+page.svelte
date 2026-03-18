<script lang="ts">
	import { page } from '$app/stores';
	import { Spinner } from '$lib/components/admin';
	import { getCampaign } from '../../campaigns.remote';
	import CampaignEditor from '../CampaignEditor.svelte';

	let id = $derived(Number($page.params.id));
	let campaignQuery = $derived(getCampaign(id));

	// Keep the first loaded campaign stable — don't remount the editor on re-fetches
	let initialCampaign = $state<typeof campaignQuery.current>(undefined);
	$effect(() => {
		const val = campaignQuery.current;
		if (val !== undefined && initialCampaign === undefined) {
			initialCampaign = val;
		}
	});
</script>

{#if !initialCampaign && campaignQuery.loading}
	<Spinner size={48} centered />
{:else if initialCampaign}
	{#key initialCampaign.id}
		<CampaignEditor mode="edit" campaign={initialCampaign} />
	{/key}
{/if}
