import type { Component } from 'solid-js';
import './DatePicker.css';

type DatePickerProps = {
	value?: string;
	onChange: (value: string) => void;
	granularity?: 'day' | 'minute';
	min?: string;
	disabled?: boolean;
};

export const DatePicker: Component<DatePickerProps> = (props) => {
	const type = () => (props.granularity === 'minute' ? 'datetime-local' : 'date');

	return (
		<input
			class="date-picker-input"
			type={type()}
			value={props.value ?? ''}
			onInput={(e) => props.onChange(e.currentTarget.value)}
			min={props.min}
			disabled={props.disabled}
		/>
	);
};
