import type { Component, JSX } from "solid-js";
import "./Badge.css";

type BadgeVariant = "default" | "success" | "error" | "warning" | "info";

type BadgeProps = {
  children: JSX.Element;
  variant?: BadgeVariant;
};

export const Badge: Component<BadgeProps> = (props) => {
  return (
    <span class={`badge badge-${props.variant ?? "default"}`}>
      {props.children}
    </span>
  );
};
