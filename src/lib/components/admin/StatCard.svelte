<script lang="ts">
	let {
		value,
		label,
	}: {
		value: string | number;
		label: string;
	} = $props();
</script>

<div class="stat-card">
	<span class="stat-value">{value}</span>
	<span class="stat-label">{label}</span>
</div>

<style>
	.stat-card {
		background: #fff;
		border-radius: var(--radius-lg);
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		box-shadow: var(--admin-shadow);
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-yahblack);
	}

	.stat-label {
		font-size: 0.85rem;
		color: var(--admin-muted);
	}
</style>
