import type { Component } from "solid-js";
import { Show } from "solid-js";
import { Switch as KobalteSwitch } from "@kobalte/core/switch";
import "./Switch.css";

type SwitchProps = {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  name?: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

export const Switch: Component<SwitchProps> = (props) => {
  return (
    <div class="switch-wrapper">
      <KobalteSwitch
        class="switch-field"
        checked={props.checked}
        onChange={props.onChange}
        name={props.name}
        disabled={props.disabled}
      >
        <KobalteSwitch.Input />
        <KobalteSwitch.Control class="switch-track">
          <KobalteSwitch.Thumb class="switch-thumb" />
        </KobalteSwitch.Control>
        <KobalteSwitch.Label class="switch-label">{props.label}</KobalteSwitch.Label>
      </KobalteSwitch>
      <Show when={props.hint}>
        <span class="switch-hint">{props.hint}</span>
      </Show>
    </div>
  );
};
