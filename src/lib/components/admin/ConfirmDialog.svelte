<script lang="ts">
	import type { Snippet } from 'svelte';
	import { AlertDialog } from 'bits-ui';

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel = 'Confirm',
		variant = 'danger',
		children,
	}: {
		open: boolean;
		title: string;
		description: string;
		confirmLabel?: string;
		variant?: 'danger' | 'primary';
		children?: Snippet;
	} = $props();
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

					{#if children}
						{@render children()}
					{/if}

					<div class="confirm-actions">
						<AlertDialog.Cancel>
							{#snippet child({ props: cancelProps })}
								<button {...cancelProps} class="confirm-cancel">Cancel</button>
							{/snippet}
						</AlertDialog.Cancel>
						<AlertDialog.Action>
							{#snippet child({ props: actionProps })}
								<button {...actionProps} class="confirm-action confirm-action-{variant}">
									{confirmLabel}
								</button>
							{/snippet}
						</AlertDialog.Action>
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
		background: rgba(0, 0, 0, 0.5);
		z-index: 50;
	}

	.confirm-content {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: #fff;
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		max-width: 420px;
		width: 90%;
		z-index: 51;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
	}

	.confirm-title {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-yahdarkblue);
		margin: 0 0 0.5rem;
	}

	.confirm-description {
		font-size: 0.9rem;
		color: var(--admin-muted);
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
		border: 1px solid var(--admin-border);
		border-radius: var(--radius-md);
		background: #fff;
		color: var(--admin-muted);
		font-size: 0.9rem;
		cursor: pointer;
	}

	.confirm-cancel:hover {
		background: var(--admin-border-light);
	}

	.confirm-action {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: var(--radius-md);
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		color: #fff;
	}

	.confirm-action-danger {
		background-color: var(--destructive);
	}

	.confirm-action-primary {
		background-color: var(--color-yahrange);
	}
</style>
