import { type Component, For, Show, createMemo } from 'solid-js';
import { Combobox } from '@kobalte/core/combobox';
import './MultiSelect.css';

export type MultiSelectOption = {
	value: string;
	label: string;
	detail?: string;
};

type MultiSelectProps = {
	selected: string[];
	onChange: (selected: string[]) => void;
	options: MultiSelectOption[];
	placeholder?: string;
	disabled?: boolean;
};

export const MultiSelect: Component<MultiSelectProps> = (props) => {
	const selectedOptions = createMemo(() =>
		props.options.filter((o) => props.selected.includes(o.value)),
	);

	return (
		<Combobox<MultiSelectOption>
			multiple
			options={props.options}
			optionValue="value"
			optionTextValue="label"
			optionLabel="label"
			value={selectedOptions()}
			onChange={(opts) => props.onChange(opts.map((o) => o.value))}
			disabled={props.disabled}
			removeOnBackspace
			triggerMode="focus"
			itemComponent={(itemProps) => (
				<Combobox.Item item={itemProps.item} class="ms-item">
					<Combobox.ItemLabel class="ms-item-label">
						{itemProps.item.rawValue.label}
					</Combobox.ItemLabel>
					<Show when={itemProps.item.rawValue.detail}>
						<span class="ms-item-detail">{itemProps.item.rawValue.detail}</span>
					</Show>
					<Combobox.ItemIndicator class="ms-item-check">✓</Combobox.ItemIndicator>
				</Combobox.Item>
			)}
		>
			<Combobox.Control<MultiSelectOption> class="chip-input-wrap">
				{(state) => (
					<>
						<For each={state.selectedOptions()}>
							{(option) => (
								<span class="chip" onPointerDown={(e) => e.stopPropagation()}>
									{option.label}
									<button
										type="button"
										class="chip-remove"
										onPointerDown={(e) => { e.stopPropagation(); state.remove(option); }}
										aria-label={`Remove ${option.label}`}
									>
										×
									</button>
								</span>
							)}
						</For>
						<Combobox.Input
							class="chip-text-input"
							placeholder={props.selected.length === 0 ? (props.placeholder ?? 'Select…') : ''}
						/>
						<Combobox.Trigger class="ms-trigger" aria-label="Open">
							<Combobox.Icon class="ms-icon">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="6 9 12 15 18 9" />
								</svg>
							</Combobox.Icon>
						</Combobox.Trigger>
					</>
				)}
			</Combobox.Control>
			<Combobox.Portal>
				<Combobox.Content class="ms-content">
					<Combobox.Listbox class="ms-listbox" />
				</Combobox.Content>
			</Combobox.Portal>
		</Combobox>
	);
};
