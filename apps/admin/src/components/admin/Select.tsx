import type { Component } from "solid-js";
import { createMemo } from "solid-js";
import { Select as KobalteSelect } from "@kobalte/core/select";
import "./Select.css";

type SelectOption = { value: string; label: string };

type SelectProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  class?: string;
};

export const Select: Component<SelectProps> = (props) => {
  const selectedOption = createMemo(() =>
    props.options.find((o) => o.value === props.value) ?? null
  );

  return (
    <KobalteSelect
      value={selectedOption()}
      onChange={(opt) => opt && props.onValueChange?.(opt.value)}
      options={props.options}
      optionValue="value"
      optionTextValue="label"
      placeholder={props.placeholder ?? "Select..."}
      disabled={props.disabled}
      name={props.name}
      itemComponent={(itemProps) => (
        <KobalteSelect.Item item={itemProps.item} class="sel-item">
          <KobalteSelect.ItemLabel>{itemProps.item.rawValue.label}</KobalteSelect.ItemLabel>
        </KobalteSelect.Item>
      )}
    >
      <KobalteSelect.Trigger class={`sel-trigger${props.class ? ` ${props.class}` : ""}`}>
        <KobalteSelect.Value<SelectOption> class="sel-value">
          {(state) => state.selectedOption().label}
        </KobalteSelect.Value>
        <KobalteSelect.Icon class="sel-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </KobalteSelect.Icon>
      </KobalteSelect.Trigger>
      <KobalteSelect.Portal>
        <KobalteSelect.Content class="sel-content">
          <KobalteSelect.Listbox />
        </KobalteSelect.Content>
      </KobalteSelect.Portal>
    </KobalteSelect>
  );
};
