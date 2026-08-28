import { For } from 'solid-js';

export type SectionNavigationItem = {
	href: string;
	label: string;
	selected: boolean;
};

export function SectionNavigation(props: { label: string; items: SectionNavigationItem[] }) {
	return (
		<nav class="section-nav" aria-label={props.label}>
			<For each={props.items}>
				{(item) => <a href={item.href} aria-current={item.selected ? 'page' : undefined}>{item.label}</a>}
			</For>
		</nav>
	);
}
