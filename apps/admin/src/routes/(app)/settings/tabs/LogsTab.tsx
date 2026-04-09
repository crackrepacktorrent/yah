import { createSignal, For, onMount } from 'solid-js';
import { Button, Spinner } from '~/components';
import { toastError } from '~/lib/utils';
import { getEmailLogs } from '../../settings.server';

export function LogsTab() {
	const [lines, setLines] = createSignal<string[]>([]);
	const [loading, setLoading] = createSignal(false);
	let containerRef: HTMLDivElement | undefined;

	function scrollToBottom() {
		if (containerRef) {
			containerRef.scrollTop = containerRef.scrollHeight;
		}
	}

	async function fetchLogs() {
		setLoading(true);
		try {
			const data = await getEmailLogs();
			setLines(data);
			// Wait a tick for the DOM to update before scrolling.
			requestAnimationFrame(scrollToBottom);
		} catch (err) {
			toastError(err, 'Failed to fetch logs.');
		} finally {
			setLoading(false);
		}
	}

	onMount(() => { void fetchLogs(); });

	return (
		<div class="logs-tab">
			<div class="logs-toolbar">
				<Button variant="secondary" onClick={fetchLogs} disabled={loading()}>
					{loading() ? 'Refreshing…' : 'Refresh'}
				</Button>
			</div>

			<div class="logs-container" ref={containerRef}>
				{loading() && lines().length === 0 ? (
					<div class="logs-loading"><Spinner /></div>
				) : (
					<For each={lines()}>
						{(line) => (
							<div class={`logs-line${/error/i.test(line) ? ' logs-line-error' : ''}`}>
								{line}
							</div>
						)}
					</For>
				)}
			</div>
		</div>
	);
}
