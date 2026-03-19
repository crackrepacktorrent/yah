<script lang="ts">
	let {
		checked,
		indeterminate = false,
		disabled = false,
		onchange,
	}: {
		checked: boolean;
		indeterminate?: boolean;
		disabled?: boolean;
		onchange: (e: Event) => void;
	} = $props();
</script>

<input
	type="checkbox"
	class="row-checkbox"
	{checked}
	{indeterminate}
	{disabled}
	{onchange}
/>
