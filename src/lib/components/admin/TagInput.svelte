<script lang="ts">
	let {
		tags = $bindable<string[]>([]),
		placeholder = 'Add a tag...',
		disabled = false,
	}: {
		tags?: string[];
		placeholder?: string;
		disabled?: boolean;
	} = $props();

	let input = $state('');

	function addTag() {
		const value = input.trim();
		if (value && !tags.includes(value)) {
			tags = [...tags, value];
		}
		input = '';
	}

	function removeTag(tag: string) {
		tags = tags.filter((t) => t !== tag);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addTag();
		}
		if (e.key === 'Backspace' && !input && tags.length > 0) {
			tags = tags.slice(0, -1);
		}
	}
</script>

<div class="chip-input-wrap" class:disabled>
	{#each tags as tag (tag)}
		<span class="chip">
			{tag}
			{#if !disabled}
				<button class="chip-remove" type="button" onclick={() => removeTag(tag)} aria-label="Remove {tag}">&times;</button>
			{/if}
		</span>
	{/each}
	{#if !disabled}
		<input
			type="text"
			class="chip-text-input"
			bind:value={input}
			onkeydown={handleKeydown}
			onblur={addTag}
			{placeholder}
		/>
	{/if}
</div>
