import { type RouteDefinition, useNavigate } from '@solidjs/router';
import { Show, createEffect, createMemo, type ParentProps } from 'solid-js';
import { getSession } from '~/platform/auth/session';

export const route = {
	preload: () => void getSession(),
} satisfies RouteDefinition;

export default function GuestLayout(props: ParentProps) {
	const navigate = useNavigate();
	const session = createMemo(() => getSession());

	createEffect(
		() => session()?.authorized,
		(authorized) => {
			if (authorized) navigate('/', { replace: true });
		},
	);

	return <Show when={!session()?.authorized}>{props.children}</Show>;
}
