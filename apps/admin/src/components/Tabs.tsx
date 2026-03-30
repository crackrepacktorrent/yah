import type { Component, JSX } from "solid-js";
import { For } from "solid-js";
import { Tabs as KobalteTabs } from "@kobalte/core/tabs";
import "./Tabs.css";

type Tab = { value: string; label: string };

type TabsProps = {
  value?: string;
  onChange?: (value: string) => void;
  tabs: Tab[];
  children: JSX.Element;
};

export const Tabs: Component<TabsProps> = (props) => {
  return (
    <KobalteTabs value={props.value} onChange={props.onChange}>
      <KobalteTabs.List class="tabs-list">
        <For each={props.tabs}>
          {(tab) => (
            <KobalteTabs.Trigger class="tab-trigger" value={tab.value}>
              {tab.label}
            </KobalteTabs.Trigger>
          )}
        </For>
      </KobalteTabs.List>
      {props.children}
    </KobalteTabs>
  );
};

export const TabContent = KobalteTabs.Content;
