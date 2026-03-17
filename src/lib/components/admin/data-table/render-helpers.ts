import type { Component } from 'svelte';
import type { Snippet } from 'svelte';

export interface RenderComponentConfig<TProps extends Record<string, unknown>> {
	component: Component<TProps>;
	props: TProps;
}

export interface RenderSnippetConfig<TProps> {
	snippet: Snippet<[TProps]>;
	params: TProps;
}

export function renderComponent<TProps extends Record<string, unknown>>(
	component: Component<TProps>,
	props: TProps
): RenderComponentConfig<TProps> {
	return { component, props };
}

export function renderSnippet<TProps>(
	snippet: Snippet<[TProps]>,
	params: TProps
): RenderSnippetConfig<TProps> {
	return { snippet, params };
}
