<script lang="ts">
	import { Switch as BitsSwitch } from 'bits-ui';

	let {
		checked = $bindable(false),
		name,
		label,
		hint,
		disabled = false,
	}: {
		checked?: boolean;
		name?: string;
		label: string;
		hint?: string;
		disabled?: boolean;
	} = $props();
</script>

<div class="switch-wrapper">
	<label class="switch-field" class:switch-disabled={disabled}>
		<BitsSwitch.Root bind:checked {name} {disabled}>
			{#snippet child({ props, checked: isChecked })}
				<button {...props} class="switch-track" class:switch-on={isChecked}>
					<span class="switch-thumb" class:switch-thumb-on={isChecked}></span>
				</button>
			{/snippet}
		</BitsSwitch.Root>
		<span class="switch-label">{label}</span>
	</label>
	{#if hint}
		<span class="switch-hint">{hint}</span>
	{/if}
</div>

<style>
	.switch-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.switch-field {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-foreground);
	}

	.switch-hint {
		font-size: 0.8rem;
		font-weight: 400;
		color: var(--color-muted);
		padding-left: calc(40px + 0.75rem);
	}

	.switch-track {
		position: relative;
		width: 40px;
		height: 22px;
		border-radius: 11px;
		background: var(--color-border);
		border: none;
		cursor: pointer;
		transition: background-color 0.2s;
		padding: 0;
		flex-shrink: 0;
	}

	.switch-on {
		background: var(--color-primary);
	}

	.switch-track:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.switch-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--color-surface);
		transition: transform 0.2s;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
	}

	.switch-thumb-on {
		transform: translateX(18px);
	}

	.switch-disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.switch-label {
		font-weight: 400;
		user-select: none;
	}
</style>
