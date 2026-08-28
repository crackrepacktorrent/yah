import { Show, type Element as SolidElement } from 'solid-js';

export type PageHeaderProps = {
	children?: SolidElement;
	description?: SolidElement;
	eyebrow?: SolidElement;
	title: SolidElement;
};

/** Shared page-title structure; feature routes retain ownership of their actions. */
export function PageHeader(props: PageHeaderProps) {
	return (
		<header class="page-header">
			<div>
				<Show when={props.eyebrow}>{(eyebrow) => <p class="eyebrow">{eyebrow()}</p>}</Show>
				<h1>{props.title}</h1>
				<Show when={props.description}>{(description) => <p>{description()}</p>}</Show>
			</div>
			{props.children}
		</header>
	);
}
