<script lang="ts">
	import { AlertDialog } from 'bits-ui';
	import Button from './Button.svelte';

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
								<Button variant="ghost" {...cancelProps} disabled={pending}>Cancel</Button>
							{/snippet}
						</AlertDialog.Cancel>
						<Button
							variant={variant === 'danger' ? 'danger' : 'primary'}
							onclick={handleConfirm}
							disabled={pending}
						>
							{pending ? "..." : confirmLabel}
						</Button>
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
</style>
