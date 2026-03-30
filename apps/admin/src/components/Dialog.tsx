import type { Component, JSX } from 'solid-js';
import { Show } from 'solid-js';
import { Dialog as KobalteDialog } from '@kobalte/core/dialog';
import './Dialog.css';

type DialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	maxWidth?: string;
	children: JSX.Element;
	footer?: JSX.Element;
};

export const Dialog: Component<DialogProps> = (props) => {
	return (
		<KobalteDialog open={props.open} onOpenChange={props.onOpenChange}>
			<KobalteDialog.Portal>
				<KobalteDialog.Overlay class="dialog-overlay" />
				<KobalteDialog.Content
					class="dialog-content"
					style={props.maxWidth ? { 'max-width': props.maxWidth } : undefined}
				>
					<div class="dialog-header">
						<KobalteDialog.Title class="dialog-title">{props.title}</KobalteDialog.Title>
						<KobalteDialog.CloseButton class="dialog-close" aria-label="Close">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="18" y1="6" x2="6" y2="18" />
								<line x1="6" y1="6" x2="18" y2="18" />
							</svg>
						</KobalteDialog.CloseButton>
					</div>
					<div class="dialog-body">{props.children}</div>
					<Show when={props.footer}>
						<div class="dialog-footer">{props.footer}</div>
					</Show>
				</KobalteDialog.Content>
			</KobalteDialog.Portal>
		</KobalteDialog>
	);
};
