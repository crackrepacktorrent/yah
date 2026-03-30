import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import { Breadcrumbs } from "@kobalte/core/breadcrumbs";
import "./Breadcrumb.css";

type BreadcrumbItem = { label: string; href?: string };

type BreadcrumbProps = {
  items: BreadcrumbItem[];
};

const Separator = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const Breadcrumb: Component<BreadcrumbProps> = (props) => {
  return (
    <Breadcrumbs>
      <ol class="breadcrumb-list">
        <For each={props.items}>
          {(item, i) => (
            <>
              <Show when={i() > 0}>
                <li class="separator" aria-hidden="true">
                  <Breadcrumbs.Separator><Separator /></Breadcrumbs.Separator>
                </li>
              </Show>
              <li>
                <Show
                  when={item.href && i() < props.items.length - 1}
                  fallback={
                    <Breadcrumbs.Link current as="span" class="current">
                      {item.label}
                    </Breadcrumbs.Link>
                  }
                >
                  <Breadcrumbs.Link href={item.href} class="bc-link">
                    {item.label}
                  </Breadcrumbs.Link>
                </Show>
              </li>
            </>
          )}
        </For>
      </ol>
    </Breadcrumbs>
  );
};
