import type { Element as SolidElement } from 'solid-js';
import { InputField } from '~/ui/form-field';

export function StoredSecretField(props: {
	label: string;
	value: string;
	hasSaved: boolean;
	disabled: boolean;
	help: SolidElement;
	savedPlaceholder?: string;
	onInput: (value: string) => void;
}) {
	return (
		<InputField
			label={props.label}
			help={props.help}
			type="password"
			value={props.value}
			maxlength="10000"
			disabled={props.disabled}
			placeholder={props.hasSaved ? (props.savedPlaceholder ?? 'Saved credential') : ''}
			onInput={(event) => props.onInput(event.currentTarget.value)}
		/>
	);
}
