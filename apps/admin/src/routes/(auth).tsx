import { createAsync, Navigate } from '@solidjs/router';
import { Show, Suspense, type JSX } from 'solid-js';
import { getSession } from '~/routes/session';

export default function AuthLayout(props: { children: JSX.Element }) {
	const session = createAsync(() => getSession());

	return (
		<Suspense>
			<Show when={!session()?.authorized} fallback={<Navigate href="/" />}>
				{props.children}
			</Show>
		</Suspense>
	);
}
