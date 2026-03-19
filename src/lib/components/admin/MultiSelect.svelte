<script lang="ts">
	let {
		selected = $bindable<string[]>([]),
		options,
		placeholder = 'Select...',
		disabled = false,
	}: {
		selected?: string[];
		options: { value: string; label: string; detail?: string }[];
		placeholder?: string;
		disabled?: boolean;
	} = $props();

	let open = $state(false);
	let search = $state('');
	let inputEl = $state<HTMLInputElement | null>(null);
	let rootEl = $state<HTMLElement | null>(null);

	let filteredOptions = $derived(
		search
			? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
			: options,
	);

	function toggle(value: string) {
		if (selected.includes(value)) {
			selected = selected.filter((v) => v !== value);
		} else {
			selected = [...selected, value];
		}
		search = '';
		inputEl?.focus();
	}

	function remove(value: string) {
		selected = selected.filter((v) => v !== value);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Backspace' && !search && selected.length > 0) {
			selected = selected.slice(0, -1);
		}
		if (e.key === 'Escape') {
			open = false;
		}
	}

	function handleFocusOut(e: FocusEvent) {
		if (rootEl?.contains(e.relatedTarget as Node)) return;
		open = false;
	}
</script>

{#if disabled}
	<div class="chip-input-wrap disabled">
		{#each selected as value (value)}
			{@const label = options.find((o) => o.value === value)?.label ?? value}
			<span class="chip">{label}</span>
		{/each}
		{#if selected.length === 0}
			<span class="ms-placeholder">{placeholder}</span>
		{/if}
	</div>
{:else}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="ms-root" bind:this={rootEl} onfocusout={handleFocusOut}>
		<div class="chip-input-wrap" role="combobox" tabindex="-1" aria-expanded={open} aria-controls="ms-listbox" onclick={() => inputEl?.focus()}>
			{#each selected as value (value)}
				{@const label = options.find((o) => o.value === value)?.label ?? value}
				<span class="chip">
					{label}
					<button class="chip-remove" type="button" onclick={() => remove(value)} aria-label="Remove {label}">&times;</button>
				</span>
			{/each}
			<input
				bind:this={inputEl}
				class="chip-text-input"
				placeholder={selected.length === 0 ? placeholder : ''}
				bind:value={search}
				onkeydown={handleKeydown}
				onfocus={() => { open = true; }}
			/>
		</div>
		{#if open}
			<div class="ms-dropdown" id="ms-listbox" role="listbox">
				{#each filteredOptions as option (option.value)}
					{@const isSelected = selected.includes(option.value)}
					<button
						class="ms-option"
						class:selected={isSelected}
						onclick={() => toggle(option.value)}
						type="button"
					>
						<span class="ms-check">{isSelected ? '✓' : ''}</span>
						<span class="ms-option-label">{option.label}</span>
						{#if option.detail}
							<span class="ms-option-detail">{option.detail}</span>
						{/if}
					</button>
				{/each}
				{#if filteredOptions.length === 0}
					<div class="ms-empty">No options found</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.ms-root {
		position: relative;
	}

	.ms-placeholder {
		color: var(--color-muted);
		font-size: 0.9rem;
	}

	.ms-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		width: 100%;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		padding: 0.25rem;
		max-height: 220px;
		overflow-y: auto;
		z-index: var(--z-dropdown);
	}

	.ms-option {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.5rem;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--color-foreground);
		background: none;
		border: none;
		width: 100%;
		text-align: left;
	}

	.ms-option:hover {
		background: var(--color-hover);
	}

	.ms-check {
		width: 1rem;
		text-align: center;
		font-size: 0.75rem;
		color: var(--color-primary);
		flex-shrink: 0;
	}

	.ms-option-label {
		flex: 1;
	}

	.ms-option-detail {
		font-size: 0.75rem;
		color: var(--color-muted);
	}

	.ms-empty {
		padding: 0.5rem;
		font-size: 0.8rem;
		color: var(--color-muted);
		text-align: center;
	}
</style>
