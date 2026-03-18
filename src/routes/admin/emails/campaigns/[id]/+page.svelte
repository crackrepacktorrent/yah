<script lang="ts">
	import { page } from '$app/stores';
	import { Spinner } from '$lib/components/admin';
	import { getCampaign } from '../../campaigns.remote';
	import CampaignEditor from '../CampaignEditor.svelte';

	let id = $derived(Number($page.params.id));
	let campaignQuery = $derived(getCampaign(id));
	let _prev: typeof campaignQuery.current;
	let campaign = $derived.by(() => {
		const val = campaignQuery.current;
		if (val !== undefined) _prev = val;
		return val ?? _prev;
	});
</script>

{#if !campaign && campaignQuery.loading}
	<Spinner size={48} centered />
{:else if campaign}
	<CampaignEditor mode="edit" {campaign} />
{/if}
