import type { Component, JSX } from "solid-js";
import { splitProps } from "solid-js";
import { TextField } from "@kobalte/core/text-field";
import "./Input.css";

type InputProps = {
  value?: string | number;
  onInput?: JSX.EventHandler<HTMLInputElement, InputEvent>;
  onChange?: JSX.EventHandler<HTMLInputElement, Event>;
  ref?: HTMLInputElement | ((el: HTMLInputElement) => void);
  class?: string;
} & Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "class" | "ref" | "onInput" | "onChange">;

export const Input: Component<InputProps> = (props) => {
  const [local, rest] = splitProps(props, ["class", "ref"]);

  return (
    <TextField.Input
      ref={local.ref}
      class={`admin-input${local.class ? ` ${local.class}` : ""}`}
      {...rest}
    />
  );
};
