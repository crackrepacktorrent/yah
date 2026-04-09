import { createSignal, For, Show, Suspense } from 'solid-js';
import { createAsync, revalidate } from '@solidjs/router';
import { Button, Spinner } from '~/components';
import { getEmailLogs } from '../../settings.server';

export function LogsTab() {
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
		<div class="logs-tab">
			<div class="logs-toolbar">
				<Button variant="secondary" onClick={refresh} disabled={refreshing()}>
					{refreshing() ? 'Refreshing…' : 'Refresh'}
				</Button>
			</div>

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
		</div>
	);
}
