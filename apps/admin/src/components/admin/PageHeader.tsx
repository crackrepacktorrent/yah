import type { Component, JSX } from 'solid-js';
import { Show } from 'solid-js';
import './PageHeader.css';

type PageHeaderProps = {
	title: string;
	children?: JSX.Element;
};

export const PageHeader: Component<PageHeaderProps> = (props) => {
	return (
		<div class="page-header">
			<h1>{props.title}</h1>
			<Show when={props.children}>
				<div class="page-header-actions">{props.children}</div>
			</Show>
		</div>
	);
};
