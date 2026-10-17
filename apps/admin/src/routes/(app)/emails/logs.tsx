import { revalidate, useNavigate, useSearchParams } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { For, Loading, Show, createEffect, createMemo, isPending } from 'solid-js';
import { EMAIL_LOG_PAGE_SIZE, type EmailLogPage } from '~/features/email-logs/contracts';
import { emailLogHref, decodeEmailLogLocation } from '~/features/email-logs/routing';
import { listEmailLogs } from '~/features/email-logs/server';
import { Pagination } from '~/ui/pagination';
import { PageHeader } from '~/ui/page-header';

export const route = defineFileRoute('/emails/logs', {
	preload: ({ location }) => {
		void listEmailLogs(decodeEmailLogLocation(location.query));
	},
});

export default function EmailLogsPage() {
	const [searchParams] = useSearchParams();
	const request = createMemo(() => decodeEmailLogLocation(searchParams));
	const page = createMemo(() => listEmailLogs(request()));
	const refreshing = createMemo(() => isPending(page));
	const requestIdentity = createMemo(() => emailLogHref(request().page));

	return (
		<section class="email-logs-page">
			<PageHeader eyebrow="Email delivery" title="Process logs" description="Recent Listmonk process output. Common credential forms are redacted; treat the remaining diagnostics as sensitive.">
				<button class="button button--secondary" type="button" disabled={refreshing()} onClick={() => revalidate(listEmailLogs.key)}>{refreshing() ? 'Refreshing…' : 'Refresh'}</button>
			</PageHeader>
			<Loading on={requestIdentity()} fallback={<p class="table-loading" role="status">Loading process logs…</p>}>
				<Show when={page()}>{(resolved) => <EmailLogResults page={resolved()} />}</Show>
			</Loading>
		</section>
	);
}

function EmailLogResults(props: { page: EmailLogPage }) {
	const navigate = useNavigate();

	createEffect(
		() => props.page,
		(current) => {
			if (current.requestedPage !== current.page) navigate(emailLogHref(current.page), { replace: true });
		},
	);

	return (
		<>
			<div class="email-log-output" role="log" aria-label="Listmonk process logs">
				<Show when={props.page.lines.length > 0} fallback={<p>No process log entries are available.</p>}>
					<For each={props.page.lines}>{(line) => <div class={/\berror\b/iu.test(line) ? 'email-log-error' : undefined}>{line}</div>}</For>
				</Show>
			</div>
			<Pagination label="Process log pages" page={props.page.page} pageSize={EMAIL_LOG_PAGE_SIZE} total={props.page.total}
				href={emailLogHref} previousLabel="Newer" nextLabel="Older"
				summary={(totalPages) => <>Showing {props.page.lines.length} of {props.page.total} buffered lines · page {props.page.page} of {totalPages}</>} />
		</>
	);
}
