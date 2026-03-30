import type { Component, JSX } from "solid-js";
import { Show } from "solid-js";
import "./EmptyState.css";

type EmptyStateProps = {
  message: string;
  children?: JSX.Element;
};

export const EmptyState: Component<EmptyStateProps> = (props) => {
  return (
    <div class="empty-state">
      <p class="empty-message">{props.message}</p>
      <Show when={props.children}>
        <div class="empty-action">{props.children}</div>
      </Show>
    </div>
  );
};
