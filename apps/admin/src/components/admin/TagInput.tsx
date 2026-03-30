import type { Component } from 'solid-js';
import { For, createSignal } from 'solid-js';
import './TagInput.css';

type TagInputProps = {
	tags: string[];
	onChange: (tags: string[]) => void;
	placeholder?: string;
	disabled?: boolean;
	validate?: (value: string) => boolean;
};

export const TagInput: Component<TagInputProps> = (props) => {
	const [input, setInput] = createSignal('');

	function addTag(value: string) {
		const trimmed = value.trim().replace(/,+$/, '').trim();
		if (trimmed && !props.tags.includes(trimmed) && (props.validate?.(trimmed) ?? true)) {
			props.onChange([...props.tags, trimmed]);
		}
		setInput('');
	}

	function removeTag(tag: string) {
		props.onChange(props.tags.filter((t) => t !== tag));
	}

	function handleKeyDown(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addTag(e.currentTarget.value);
		} else if (e.key === 'Backspace' && !e.currentTarget.value && props.tags.length > 0) {
			removeTag(props.tags[props.tags.length - 1]!);
		}
	}

	return (
		<div class={`chip-input-wrap${props.disabled ? ' disabled' : ''}`}>
			<For each={props.tags}>
				{(tag) => (
					<span class="chip">
						{tag}
						<button
							type="button"
							class="chip-remove"
							onClick={() => removeTag(tag)}
							disabled={props.disabled}
							aria-label={`Remove ${tag}`}
						>
							×
						</button>
					</span>
				)}
			</For>
			<input
				class="chip-text-input"
				type="text"
				value={input()}
				onInput={(e) => setInput(e.currentTarget.value)}
				onKeyDown={handleKeyDown}
				onBlur={(e) => { if (e.currentTarget.value) addTag(e.currentTarget.value); }}
				placeholder={props.tags.length === 0 ? (props.placeholder ?? 'Add tag…') : ''}
				disabled={props.disabled}
			/>
		</div>
	);
};
