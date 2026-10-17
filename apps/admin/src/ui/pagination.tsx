import type { JSX } from '@solidjs/web';
import { Show, createMemo } from 'solid-js';

export function Pagination(props: {
	label: string;
	page: number;
	pageSize: number;
	total: number;
	href: (page: number) => string;
	summary?: (totalPages: number) => JSX.Element;
	previousLabel?: string;
	nextLabel?: string;
}) {
	const totalPages = createMemo(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
	return (
		<nav class="pagination" aria-label={props.label}>
			<span>{props.summary ? props.summary(totalPages()) : <>Page {props.page.toLocaleString()} of {totalPages().toLocaleString()} · {props.total.toLocaleString()} total</>}</span>
			<div>
				<Show when={props.page > 1}><a class="button button--secondary" rel="prev" href={props.href(props.page - 1)}>{props.previousLabel ?? 'Previous'}</a></Show>
				<Show when={props.page < totalPages()}><a class="button button--secondary" rel="next" href={props.href(props.page + 1)}>{props.nextLabel ?? 'Next'}</a></Show>
			</div>
		</nav>
	);
}
