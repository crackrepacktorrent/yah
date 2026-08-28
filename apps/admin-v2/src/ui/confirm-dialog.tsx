import { Show, createEffect, createUniqueId } from 'solid-js';
import './confirm-dialog.css';

export function ConfirmDialog(props: {
	open: boolean;
	title: string;
	description: string;
	confirmLabel: string;
	confirmTone?: 'danger' | 'primary';
	pending?: boolean;
	error?: string;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
}) {
	let dialog: HTMLDialogElement | undefined;
	let returnFocus: HTMLElement | null = null;
	const id = createUniqueId();
	const titleId = `${id}-title`;
	const descriptionId = `${id}-description`;

	createEffect(
		() => props.open,
		(open) => {
		if (!dialog) return;
		if (open && !dialog.open) {
			returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
		},
	);

	function close(): void {
		if (props.pending) return;
		props.onOpenChange(false);
	}

	return (
		<dialog
			ref={(element) => {
				dialog = element;
			}}
			class="confirm-dialog"
			onCancel={(event) => {
				if (props.pending) event.preventDefault();
				else props.onOpenChange(false);
			}}
			onClose={() => {
				if (props.open) props.onOpenChange(false);
				queueMicrotask(() => returnFocus?.isConnected && returnFocus.focus());
			}}
			aria-labelledby={titleId}
			aria-describedby={descriptionId}
		>
			<h2 id={titleId}>{props.title}</h2>
			<p id={descriptionId}>{props.description}</p>
			<Show when={props.error}>{(message) => <p class="field-error" role="alert">{message()}</p>}</Show>
			<div class="confirm-dialog__actions">
				<button type="button" class="button button--secondary confirm-dialog__button" onClick={close} disabled={props.pending} autofocus>
					Cancel
				</button>
				<button
					type="button"
					class={[
						'button confirm-dialog__button',
						{
							'button--danger': (props.confirmTone ?? 'danger') === 'danger',
						},
					]}
					onClick={() => props.onConfirm()}
					disabled={props.pending}
					aria-busy={props.pending ? 'true' : undefined}
				>
					{props.pending ? 'Working…' : props.confirmLabel}
				</button>
			</div>
		</dialog>
	);
}
