import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import './Card.css';

type CardVariant = 'default' | 'flat' | 'interactive';

type CardProps = {
	children: JSX.Element;
	maxWidth?: string;
	variant?: CardVariant;
	class?: string;
} & JSX.HTMLAttributes<HTMLDivElement>;

export const Card: Component<CardProps> = (props) => {
	const [local, rest] = splitProps(props, ['children', 'maxWidth', 'variant', 'class']);

	const cls = () => {
		const parts = ['card'];
		if (local.variant && local.variant !== 'default') parts.push(`card--${local.variant}`);
		if (local.class) parts.push(local.class);
		return parts.join(' ');
	};

	return (
		<div
			class={cls()}
			style={local.maxWidth ? { 'max-width': local.maxWidth } : undefined}
			{...rest}
		>
			{local.children}
		</div>
	);
};
