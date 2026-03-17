<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		required = false,
		hint,
		children,
	}: {
		label: string;
		required?: boolean;
		hint?: string;
		children: Snippet;
	} = $props();
</script>

<label class="form-field">
	<span class="form-field-label">
		{label}{#if required}<span class="required-mark"> *</span>{/if}
		{#if hint}<span class="form-field-hint">{hint}</span>{/if}
	</span>
	{@render children()}
</label>

<style>
	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-weight: 500;
		font-size: 0.9rem;
		color: var(--color-yahblack);
	}

	.form-field-label {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.required-mark {
		color: var(--destructive);
	}

	.form-field-hint {
		font-weight: 400;
		color: var(--admin-muted);
		font-size: 0.8rem;
	}
</style>
