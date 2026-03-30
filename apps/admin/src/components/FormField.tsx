import type { Component, JSX } from "solid-js";
import { Show } from "solid-js";
import { TextField } from "@kobalte/core/text-field";
import "./FormField.css";

type FormFieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: JSX.Element;
};

export const FormField: Component<FormFieldProps> = (props) => {
  return (
    <TextField
      class={`form-field${props.error ? " has-error" : ""}`}
      validationState={props.error ? "invalid" : undefined}
    >
      <TextField.Label as="span" class="form-field-label">
        {props.label}
        <Show when={props.required}>
          <span class="required-mark"> *</span>
        </Show>
      </TextField.Label>
      {props.children}
      <Show when={props.error}>
        <TextField.ErrorMessage class="form-field-error">{props.error}</TextField.ErrorMessage>
      </Show>
      <Show when={!props.error && props.hint}>
        <TextField.Description class="form-field-hint">{props.hint}</TextField.Description>
      </Show>
    </TextField>
  );
};
