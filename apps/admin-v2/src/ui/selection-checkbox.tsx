// eslint-disable-next-line solid/imports -- Solid 2 DOM JSX types are renderer-owned.
import type { JSX } from '@solidjs/web';
import { createEffect } from 'solid-js';

export function SelectionCheckbox(props: {
	label: string;
	checked: boolean;
	disabled?: boolean;
	indeterminate?: boolean;
	onChange: JSX.EventHandler<HTMLInputElement, Event>;
}) {
	let input: HTMLInputElement | undefined;
	createEffect(
		() => props.indeterminate ?? false,
		(indeterminate) => {
			if (input) input.indeterminate = indeterminate;
		},
	);
	return <input ref={(element) => { input = element; }} type="checkbox" aria-label={props.label} checked={props.checked} disabled={props.disabled} onChange={(event) => props.onChange(event)} />;
}
