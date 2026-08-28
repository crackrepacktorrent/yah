import { revalidate, useNavigate, useSearchParams } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { For, Show, createEffect, createMemo, isPending } from 'solid-js';
import { emailLogHref, emailLogPageCount, decodeEmailLogLocation } from '~/features/email-logs/routing';
import { listEmailLogs } from '~/features/email-logs/server';

export const route = defineFileRoute('/emails/logs', {
	preload: ({ location }) => {
		void listEmailLogs(decodeEmailLogLocation(location.query));
	},
});

export default function EmailLogsPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const request = createMemo(() => decodeEmailLogLocation(searchParams));
	const page = createMemo(() => listEmailLogs(request()));
	const refreshing = createMemo(() => isPending(page));

	createEffect(() => page(), (current) => {
		if (current.requestedPage !== current.page) navigate(emailLogHref(current.page), { replace: true });
	});

	return (
		<section class="email-logs-page">
			<header class="page-header">
				<div><p class="eyebrow">Email delivery</p><h1>Process logs</h1><p>Recent Listmonk process output. Common credential forms are redacted; treat the remaining diagnostics as sensitive.</p></div>
				<button class="button button--secondary" type="button" disabled={refreshing()} onClick={() => revalidate(listEmailLogs.key)}>{refreshing() ? 'Refreshing…' : 'Refresh'}</button>
			</header>
			<div class="email-log-output" role="log" aria-label="Listmonk process logs">
				<Show when={page().lines.length > 0} fallback={<p>No process log entries are available.</p>}>
					<For each={page().lines}>{(line) => <div class={/\berror\b/iu.test(line) ? 'email-log-error' : undefined}>{line}</div>}</For>
				</Show>
			</div>
			<nav class="email-log-pagination" aria-label="Process log pages">
				<span>Showing {page().lines.length} of {page().total} buffered lines · page {page().page} of {emailLogPageCount(page().total)}</span>
				<div>
					<Show when={page().page > 1}><a class="button button--secondary" href={emailLogHref(page().page - 1)}>Newer</a></Show>
					<Show when={page().page < emailLogPageCount(page().total)}><a class="button button--secondary" href={emailLogHref(page().page + 1)}>Older</a></Show>
				</div>
			</nav>
		</section>
	);
}
