import { createSignal, For, Show, Suspense } from 'solid-js';
import { createAsync, revalidate, type RouteDefinition } from '@solidjs/router';
import { Card, PageHeader, Button, Spinner } from '~/components';
import { getEmailLogs } from '../settings.server';
import './logs.css';

export const route: RouteDefinition = {
	preload: () => { void getEmailLogs(); },
};

export default function LogsPage() {
	const logs = createAsync(() => getEmailLogs());
	const [refreshing, setRefreshing] = createSignal(false);
	let containerRef: HTMLDivElement | undefined;

	function scrollToBottom() {
		if (containerRef) containerRef.scrollTop = containerRef.scrollHeight;
	}

	async function refresh() {
		setRefreshing(true);
		try {
			await revalidate('getEmailLogs');
			requestAnimationFrame(scrollToBottom);
		} finally {
			setRefreshing(false);
		}
	}

	return (
		<>
			<PageHeader title="Email Logs">
				<Button variant="secondary" onClick={refresh} disabled={refreshing()}>
					{refreshing() ? 'Refreshing…' : 'Refresh'}
				</Button>
			</PageHeader>

			<Card>
				<div class="logs-container" ref={(el) => { containerRef = el; requestAnimationFrame(scrollToBottom); }}>
					<Suspense fallback={<div class="logs-loading"><Spinner /></div>}>
						<Show when={logs()}>
							{(lines) => (
								<For each={lines()}>
									{(line) => (
										<div class={`logs-line${/error/i.test(line) ? ' logs-line-error' : ''}`}>
											{line}
										</div>
									)}
								</For>
							)}
						</Show>
					</Suspense>
				</div>
			</Card>
		</>
	);
}
