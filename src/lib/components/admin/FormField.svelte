<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		required = false,
		hint,
		error,
		children,
	}: {
		label: string;
		required?: boolean;
		hint?: string;
		error?: string;
		children: Snippet;
	} = $props();
</script>

<div class="form-field" class:has-error={!!error}>
	<span class="form-field-label">
		{label}{#if required}<span class="required-mark"> *</span>{/if}
	</span>
	{@render children()}
	{#if error}
		<span class="form-field-error">{error}</span>
	{:else if hint}
		<span class="form-field-hint">{hint}</span>
	{/if}
</div>

<style>
	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-weight: 500;
		font-size: 0.9rem;
		color: var(--color-foreground);
	}

	.form-field-label {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
	}

	.required-mark {
		color: var(--color-destructive);
	}

	.form-field-hint {
		font-weight: 400;
		color: var(--color-muted);
		font-size: 0.8rem;
	}

	.form-field-error {
		font-weight: 400;
		color: var(--color-destructive);
		font-size: 0.8rem;
	}

	/* Red border on inputs inside errored fields */
	.has-error :global(input),
	.has-error :global(textarea),
	.has-error :global(.chip-input-wrap),
	.has-error :global(.sel-trigger),
	.has-error :global(.ms-root > .chip-input-wrap) {
		border-color: var(--color-destructive);
	}
</style>
