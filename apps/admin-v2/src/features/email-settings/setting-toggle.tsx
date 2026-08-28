export function SettingToggle(props: {
	label: string;
	help: string;
	checked: boolean;
	disabled: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label class="settings-check-field">
			<input
				type="checkbox"
				checked={props.checked}
				disabled={props.disabled}
				onChange={(event) => props.onChange(event.currentTarget.checked)}
			/>
			<span><strong>{props.label}</strong><small>{props.help}</small></span>
		</label>
	);
}
