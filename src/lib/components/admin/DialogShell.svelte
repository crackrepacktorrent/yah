<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';

	let {
		open = $bindable(false),
		title,
		maxWidth = '520px',
		children,
	}: {
		open: boolean;
		title: string;
		maxWidth?: string;
		children: Snippet;
	} = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay>
			{#snippet child({ props })}
				<div {...props} class="dialog-overlay"></div>
			{/snippet}
		</Dialog.Overlay>
		<Dialog.Content>
			{#snippet child({ props })}
				<div {...props} class="dialog-content" style:max-width={maxWidth}>
					<div class="dialog-header">
						<h2>{title}</h2>
						<Dialog.Close>
							{#snippet child({ props: closeProps })}
								<button {...closeProps} class="dialog-close">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<line x1="18" y1="6" x2="6" y2="18"></line>
										<line x1="6" y1="6" x2="18" y2="18"></line>
									</svg>
								</button>
							{/snippet}
						</Dialog.Close>
					</div>
					{@render children()}
				</div>
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	.dialog-overlay {
		position: fixed;
		inset: 0;
		background: var(--color-overlay);
		z-index: var(--z-dialog);
	}

	.dialog-content {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: var(--z-dialog-content);
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 1.5rem;
		width: 90vw;
		max-height: 90vh;
		overflow-y: auto;
	}

	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
	}

	.dialog-header h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-foreground);
	}

	.dialog-close {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-muted);
		padding: 0.25rem;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
	}

	.dialog-close:hover {
		color: var(--color-foreground);
		background: var(--color-hover);
	}
</style>
