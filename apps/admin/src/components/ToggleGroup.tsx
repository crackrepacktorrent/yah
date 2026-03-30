import type { Component } from "solid-js";
import { For } from "solid-js";
import { ToggleGroup as KobalteToggleGroup } from "@kobalte/core/toggle-group";
import "./ToggleGroup.css";

type ToggleOption = { value: string; label: string };

type ToggleGroupProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  options: ToggleOption[];
};

export const ToggleGroup: Component<ToggleGroupProps> = (props) => {
  return (
    <KobalteToggleGroup
      class="toggle-group"
      value={props.value}
      onChange={(v) => v && props.onValueChange?.(v)}
    >
      <For each={props.options}>
        {(option) => (
          <KobalteToggleGroup.Item class="toggle-item" value={option.value}>
            {option.label}
          </KobalteToggleGroup.Item>
        )}
      </For>
    </KobalteToggleGroup>
  );
};
