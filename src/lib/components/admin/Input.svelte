<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		class: className = '',
		...rest
	}: HTMLInputAttributes & { class?: string } = $props();
</script>

<input class="admin-input {className}" {...rest} />
