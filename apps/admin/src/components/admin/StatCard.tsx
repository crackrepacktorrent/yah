import type { Component } from "solid-js";
import "./StatCard.css";

type StatCardProps = {
  value: string | number;
  label: string;
  accent?: string;
};

export const StatCard: Component<StatCardProps> = (props) => {
  return (
    <div
      class="stat-card"
      style={props.accent ? { "border-top-color": props.accent } : undefined}
    >
      <span class="stat-value">{props.value}</span>
      <span class="stat-label">{props.label}</span>
    </div>
  );
};
