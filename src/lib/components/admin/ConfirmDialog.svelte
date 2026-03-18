<script lang="ts">
	import { AlertDialog } from 'bits-ui';

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel = 'Confirm',
		variant = 'danger',
		onconfirm,
	}: {
		open: boolean;
		title: string;
		description: string;
		confirmLabel?: string;
		variant?: 'danger' | 'primary';
		onconfirm: () => void | Promise<void>;
	} = $props();

	let pending = $state(false);

	async function handleConfirm() {
		pending = true;
		try {
			await onconfirm();
			open = false;
		} finally {
			pending = false;
		}
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Portal>
		<AlertDialog.Overlay>
			{#snippet child({ props })}
				<div {...props} class="confirm-overlay"></div>
			{/snippet}
		</AlertDialog.Overlay>
		<AlertDialog.Content>
			{#snippet child({ props })}
				<div {...props} class="confirm-content">
					<AlertDialog.Title>
						{#snippet child({ props: titleProps })}
							<h3 {...titleProps} class="confirm-title">{title}</h3>
						{/snippet}
					</AlertDialog.Title>
					<AlertDialog.Description>
						{#snippet child({ props: descProps })}
							<p {...descProps} class="confirm-description">{description}</p>
						{/snippet}
					</AlertDialog.Description>

					<div class="confirm-actions">
						<AlertDialog.Cancel>
							{#snippet child({ props: cancelProps })}
								<button {...cancelProps} class="confirm-cancel" disabled={pending}>Cancel</button>
							{/snippet}
						</AlertDialog.Cancel>
						<button
							class="confirm-action confirm-action-{variant}"
							onclick={handleConfirm}
							disabled={pending}
						>
							{pending ? "..." : confirmLabel}
						</button>
					</div>
				</div>
			{/snippet}
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>

<style>
	.confirm-overlay {
		position: fixed;
		inset: 0;
		background: var(--color-overlay);
		z-index: var(--z-confirm);
	}

	.confirm-content {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		max-width: 420px;
		width: 90%;
		z-index: var(--z-confirm-content);
		box-shadow: var(--shadow-lg);
	}

	.confirm-title {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-foreground);
		margin: 0 0 0.5rem;
	}

	.confirm-description {
		font-size: 0.9rem;
		color: var(--color-muted);
		margin: 0 0 1.5rem;
		line-height: 1.5;
	}

	.confirm-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
	}

	.confirm-cancel {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-muted);
		font-size: 0.9rem;
		cursor: pointer;
	}

	.confirm-cancel:hover {
		background: var(--color-hover);
	}

	.confirm-cancel:disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	.confirm-action {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: var(--radius-md);
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		color: var(--color-surface);
	}

	.confirm-action:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.confirm-action-danger {
		background-color: var(--color-destructive);
	}

	.confirm-action-primary {
		background-color: var(--color-primary);
	}
</style>
