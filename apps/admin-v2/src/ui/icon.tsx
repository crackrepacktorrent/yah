import { Dynamic } from '@solidjs/web';
// eslint-disable-next-line solid/imports -- Solid 2 SVG JSX types are renderer-owned.
import type { JSX } from '@solidjs/web';
import {
	AlertCircle,
	BarChart3,
	ChevronRight,
	ClipboardList,
	Contact,
	FileText,
	LayoutDashboard,
	Link,
	ListChecks,
	Lock,
	LogOut,
	Mail,
	Megaphone,
	Menu,
	PieChart,
	Settings,
	Shield,
	Users,
	X,
	type IconNode,
} from 'lucide';
import { For, Show } from 'solid-js';

export type IconProps = {
	node: IconNode;
	class?: string;
	label?: string;
	size?: number;
	strokeWidth?: number;
};

const nonFocusableSvg = { focusable: 'false' } as const;

export function Icon(props: IconProps): JSX.Element {
	return (
		<svg
			{...nonFocusableSvg}
			xmlns="http://www.w3.org/2000/svg"
			width={props.size ?? 24}
			height={props.size ?? 24}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width={props.strokeWidth ?? 2}
			stroke-linecap="round"
			stroke-linejoin="round"
			class={props.class}
			role={props.label ? 'img' : undefined}
			aria-label={props.label}
			aria-hidden={props.label ? undefined : 'true'}
		>
			<Show when={props.label}>{(label) => <title>{label()}</title>}</Show>
			<For each={props.node}>{(entry) => <Dynamic component={entry[0]} {...entry[1]} />}</For>
		</svg>
	);
}

export const navIcons = {
	dashboard: LayoutDashboard,
	link: Link,
	chart: BarChart3,
	mail: Mail,
	users: Users,
	contact: Contact,
	'list-checks': ListChecks,
	'alert-circle': AlertCircle,
	shield: Shield,
	megaphone: Megaphone,
	'pie-chart': PieChart,
	'clipboard-list': ClipboardList,
	'file-text': FileText,
	settings: Settings,
} as const satisfies Record<string, IconNode>;

export type NavIconName = keyof typeof navIcons;

export const uiIcons = {
	chevronRight: ChevronRight,
	lock: Lock,
	logout: LogOut,
	menu: Menu,
	close: X,
} as const satisfies Record<string, IconNode>;
