import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';
import { AlertDialog as KobalteAlertDialog } from '@kobalte/core/alert-dialog';
import { Button } from './Button';
import './AlertDialog.css';

type AlertDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	confirmLabel?: string;
	variant?: 'danger' | 'primary';
	onconfirm: () => void | Promise<void>;
};

export const AlertDialog: Component<AlertDialogProps> = (props) => {
	const [pending, setPending] = createSignal(false);

	async function handleConfirm() {
		setPending(true);
		try {
			await props.onconfirm();
			props.onOpenChange(false);
		} finally {
			setPending(false);
		}
	}

	return (
		<KobalteAlertDialog open={props.open} onOpenChange={props.onOpenChange}>
			<KobalteAlertDialog.Portal>
				<KobalteAlertDialog.Overlay class="alert-dialog-overlay" />
				<KobalteAlertDialog.Content class="alert-dialog-content">
					<KobalteAlertDialog.Title class="alert-dialog-title">{props.title}</KobalteAlertDialog.Title>
					<KobalteAlertDialog.Description class="alert-dialog-description">
						{props.description}
					</KobalteAlertDialog.Description>
					<div class="alert-dialog-actions">
						<KobalteAlertDialog.CloseButton as={Button} variant="ghost" disabled={pending()}>
							Cancel
						</KobalteAlertDialog.CloseButton>
						<Button
							variant={props.variant === 'primary' ? 'primary' : 'danger'}
							onClick={handleConfirm}
							disabled={pending()}
						>
							{pending() ? '…' : (props.confirmLabel ?? 'Confirm')}
						</Button>
					</div>
				</KobalteAlertDialog.Content>
			</KobalteAlertDialog.Portal>
		</KobalteAlertDialog>
	);
};
