import type { Component, JSX } from "solid-js";
import { Tooltip as KobalteTooltip } from "@kobalte/core/tooltip";
import "./Tooltip.css";

type TooltipProps = {
  text: string;
  children: JSX.Element;
};

export const Tooltip: Component<TooltipProps> = (props) => {
  return (
    <KobalteTooltip openDelay={300}>
      <KobalteTooltip.Trigger as="span">{props.children}</KobalteTooltip.Trigger>
      <KobalteTooltip.Portal>
        <KobalteTooltip.Content class="tooltip-content">
          <KobalteTooltip.Arrow />
          {props.text}
        </KobalteTooltip.Content>
      </KobalteTooltip.Portal>
    </KobalteTooltip>
  );
};
