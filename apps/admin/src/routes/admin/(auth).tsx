import { createAsync, Navigate } from '@solidjs/router';
import { Show, Suspense, type JSX } from 'solid-js';
import { getSession } from '~/routes/admin/session';

export default function AuthLayout(props: { children: JSX.Element }) {
	const session = createAsync(() => getSession());

	return (
		<Suspense>
			<Show when={!session()} fallback={<Navigate href="/admin" />}>
				{props.children}
			</Show>
		</Suspense>
	);
}
