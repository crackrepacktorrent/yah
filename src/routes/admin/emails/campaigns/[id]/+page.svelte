<script lang="ts">
	import { page } from '$app/state';
	import { getCampaign } from '../../campaigns.remote';
	import CampaignEditor from '../CampaignEditor.svelte';

	let campaign = $derived(await getCampaign(Number(page.params.id)));
</script>

<CampaignEditor mode="edit" {campaign} />
