import type { Component, JSX } from "solid-js";
import { Show, splitProps, mergeProps } from "solid-js";
import "./Button.css";

type ButtonVariant = "primary" | "secondary" | "danger" | "danger-outline" | "ghost";

type SharedProps = {
  variant?: ButtonVariant;
  class?: string;
  children: JSX.Element;
};

// When href is absent: full button element attributes.
type ButtonAsButton = SharedProps &
  Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, keyof SharedProps> & {
    href?: never;
  };

// When href is present: full anchor element attributes.
// disabled is not a native anchor attribute, but we use it to fall back to <button>.
type ButtonAsAnchor = SharedProps &
  Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, keyof SharedProps | "href"> & {
    href: string;
    disabled?: boolean;
  };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

export const Button: Component<ButtonProps> = (props) => {
  const merged = mergeProps({ variant: "primary" as ButtonVariant }, props);

  // Split only what we need to handle explicitly; everything else flows through rest.
  const [local, rest] = splitProps(merged, ["variant", "href", "disabled", "type", "class", "children"]);

  const buttonClass = () => `btn btn-${local.variant}${local.class ? ` ${local.class}` : ""}`;

  return (
    <Show
      when={local.href && !local.disabled}
      fallback={
        <button
          class={buttonClass()}
          disabled={local.disabled}
          type={(local.type as JSX.ButtonHTMLAttributes<HTMLButtonElement>["type"]) ?? "button"}
          {...(rest as JSX.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          {local.children}
        </button>
      }
    >
      <a href={local.href} class={buttonClass()} {...(rest as JSX.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {local.children}
      </a>
    </Show>
  );
};
