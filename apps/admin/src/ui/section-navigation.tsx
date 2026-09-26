import { useIsRouting, useLocation } from '@solidjs/router';
import { For, createEffect } from 'solid-js';

export type SectionNavigationItem = {
	href: string;
	label: string;
	selected: boolean;
};

export function NavigationLink(props: { item: SectionNavigationItem }) {
	const location = useLocation();
	const isRouting = useIsRouting();
	let anchor: HTMLAnchorElement | undefined;
	// The router updates exact-page aria-current during its render effect.
	// Apply section selection afterward, including exact-to-child navigations
	// where selected stays true. Track routing completion too: async navigation
	// triggers another router sweep after the pathname has already changed.
	createEffect(
		() => ({ pathname: location.pathname, routing: isRouting(), selected: props.item.selected }),
		({ selected }) => {
			if (selected) anchor?.setAttribute('aria-current', 'page');
			else anchor?.removeAttribute('aria-current');
		},
	);
	return <a ref={(element) => { anchor = element; }} href={props.item.href} aria-current={props.item.selected ? 'page' : undefined}>{props.item.label}</a>;
}

export function SectionNavigation(props: { label: string; items: SectionNavigationItem[] }) {
	return (
		<nav class="section-nav" aria-label={props.label}>
			<For each={props.items}>
				{(item) => <NavigationLink item={item} />}
			</For>
		</nav>
	);
}
