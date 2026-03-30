import type { Component, JSX } from 'solid-js';
import './Section.css';

type SectionProps = {
	title: string;
	children: JSX.Element;
	fill?: boolean;
	class?: string;
};

export const Section: Component<SectionProps> = (props) => {
	const cls = () => {
		const parts = ['section'];
		if (props.fill) parts.push('section--fill');
		if (props.class) parts.push(props.class);
		return parts.join(' ');
	};

	return (
		<div class={cls()}>
			<h3 class="section-title">{props.title}</h3>
			{props.children}
		</div>
	);
};
