<script lang="ts">
	import "../app.css";

	const umamiUrl = import.meta.env.VITE_UMAMI_URL;
	const umamiId = import.meta.env.VITE_UMAMI_WEBSITE_ID;

	let { children }: { children: any } = $props();
</script>

<svelte:head>
	{#if umamiUrl && umamiId}
		<script async defer data-website-id={umamiId} src="{umamiUrl}/t.js"></script>
	{/if}
</svelte:head>

{@render children()}
