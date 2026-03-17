<script lang="ts">
	let {
		value,
		label,
		accent,
	}: {
		value: string | number;
		label: string;
		accent?: string;
	} = $props();
</script>

<div class="stat-card" style:border-top-color={accent}>
	<span class="stat-value">{value}</span>
	<span class="stat-label">{label}</span>
</div>

<style>
	.stat-card {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		box-shadow: var(--shadow-sm);
		border-top: 3px solid transparent;
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-foreground);
	}

	.stat-label {
		font-size: 0.85rem;
		color: var(--color-muted);
	}
</style>
