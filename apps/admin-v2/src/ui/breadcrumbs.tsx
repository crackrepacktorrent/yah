// eslint-disable-next-line solid/imports -- Solid 2 JSX types are renderer-owned.
import type { JSX } from '@solidjs/web';
import { For } from 'solid-js';

export type BreadcrumbItem = {
	label: JSX.Element;
	href?: string;
};

export function Breadcrumbs(props: { items: BreadcrumbItem[] }) {
	return (
		<nav class="breadcrumbs" aria-label="Breadcrumb">
			<ol>
				<For each={props.items}>
					{(item, index) => (
						<li>
							{item.href
								? <a href={item.href}>{item.label}</a>
								: <span aria-current={index() === props.items.length - 1 ? 'page' : undefined}>{item.label}</span>}
						</li>
					)}
				</For>
			</ol>
		</nav>
	);
}
