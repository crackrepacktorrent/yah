import type { Component } from "solid-js";
import { Show } from "solid-js";
import "./Spinner.css";

type SpinnerProps = {
  size?: number;
  centered?: boolean;
};

const SpinnerSvg: Component<{ size: number }> = (props) => (
  <svg
    class="spinner"
    width={props.size}
    height={props.size}
    viewBox="0 0 24 24"
    fill="none"
    role="status"
    aria-label="Loading"
  >
    <circle class="spinner-track" cx="12" cy="12" r="10" stroke-width="3" />
    <path class="spinner-arc" d="M12 2a10 10 0 0 1 10 10" stroke-width="3" stroke-linecap="round" />
  </svg>
);

export const Spinner: Component<SpinnerProps> = (props) => {
  return (
    <Show
      when={props.centered}
      fallback={<SpinnerSvg size={props.size ?? 24} />}
    >
      <div class="spinner-container">
        <SpinnerSvg size={props.size ?? 24} />
      </div>
    </Show>
  );
};
