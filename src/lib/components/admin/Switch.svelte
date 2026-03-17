<script lang="ts">
	import { Switch as BitsSwitch } from 'bits-ui';

	let {
		checked = $bindable(false),
		name,
		label,
		disabled = false,
	}: {
		checked?: boolean;
		name?: string;
		label: string;
		disabled?: boolean;
	} = $props();
</script>

<label class="switch-field">
	<BitsSwitch.Root bind:checked {name} {disabled}>
		{#snippet child({ props, checked: isChecked })}
			<button {...props} class="switch-track" class:switch-on={isChecked}>
				<span class="switch-thumb" class:switch-thumb-on={isChecked}></span>
			</button>
		{/snippet}
	</BitsSwitch.Root>
	<span class="switch-label">{label}</span>
</label>

<style>
	.switch-field {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-yahblack);
	}

	.switch-track {
		position: relative;
		width: 40px;
		height: 22px;
		border-radius: 11px;
		background: var(--admin-border);
		border: none;
		cursor: pointer;
		transition: background-color 0.2s;
		padding: 0;
		flex-shrink: 0;
	}

	.switch-on {
		background: var(--color-yahrange);
	}

	.switch-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.2s;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
	}

	.switch-thumb-on {
		transform: translateX(18px);
	}

	.switch-label {
		font-weight: 400;
		user-select: none;
	}
</style>
