import { Show, createSignal, untrack } from 'solid-js';
import { InputField } from '~/ui/form-field';
import { GO_DURATION_HTML_PATTERN, type EmailPerformanceSettings, type SaveEmailPerformanceSettingsCommand } from './contracts';
import { SettingToggle } from './setting-toggle';

export function EmailPerformanceSettingsForm(props: {
	initial: EmailPerformanceSettings;
	canManage: boolean;
	pending: boolean;
	error: string;
	onSubmit: (command: SaveEmailPerformanceSettingsCommand) => void;
}) {
	const initial = untrack(() => props.initial);
	const [concurrency, setConcurrency] = createSignal(String(initial.concurrency));
	const [messageRate, setMessageRate] = createSignal(String(initial.messageRate));
	const [batchSize, setBatchSize] = createSignal(String(initial.batchSize));
	const [maxSendErrors, setMaxSendErrors] = createSignal(String(initial.maxSendErrors));
	const [slidingWindow, setSlidingWindow] = createSignal(initial.slidingWindow);
	const [slidingWindowRate, setSlidingWindowRate] = createSignal(String(initial.slidingWindowRate));
	const [slidingWindowDuration, setSlidingWindowDuration] = createSignal(initial.slidingWindowDuration);
	const [cacheSlowQueries, setCacheSlowQueries] = createSignal(initial.cacheSlowQueries);
	const [cacheSlowQueriesInterval, setCacheSlowQueriesInterval] = createSignal(initial.cacheSlowQueriesInterval);
	const disabled = () => !props.canManage || props.pending;

	return (
		<form class="settings-form" onSubmit={(event) => {
			event.preventDefault();
			props.onSubmit({
				concurrency: Number(concurrency()),
				messageRate: Number(messageRate()),
				batchSize: Number(batchSize()),
				maxSendErrors: Number(maxSendErrors()),
				slidingWindow: slidingWindow(),
				slidingWindowRate: Number(slidingWindowRate()),
				slidingWindowDuration: slidingWindowDuration(),
				cacheSlowQueries: cacheSlowQueries(),
				cacheSlowQueriesInterval: cacheSlowQueriesInterval(),
			});
		}}>
			<Show when={props.error}>{(message) => <p class="field-error" role="alert">{message()}</p>}</Show>
			<fieldset class="settings-card" disabled={disabled()}>
				<legend>Delivery throughput</legend>
				<p class="settings-warning">These values affect a resource-limited provider process. Raise them only after measuring CPU, memory, database load, and SMTP limits.</p>
				<div class="settings-domain-grid">
					<InputField label="Concurrent workers" help="Maximum workers that attempt sends simultaneously." type="number" min="1" max="10000" required value={concurrency()} onInput={(event) => setConcurrency(event.currentTarget.value)} />
					<InputField label="Messages per second per worker" help="Total ceiling is workers × this rate, subject to SMTP routing." type="number" min="1" max="100000" required value={messageRate()} onInput={(event) => setMessageRate(event.currentTarget.value)} />
					<InputField label="Subscriber batch size" help="Rows pulled from PostgreSQL per sending iteration." type="number" min="1" max="100000" required value={batchSize()} onInput={(event) => setBatchSize(event.currentTarget.value)} />
					<InputField label="Maximum send errors" help="Pauses a campaign at this count; zero never pauses automatically." type="number" min="0" max="100000" required value={maxSendErrors()} onInput={(event) => setMaxSendErrors(event.currentTarget.value)} />
				</div>
			</fieldset>
			<fieldset class="settings-card" disabled={disabled()}>
				<legend>Sliding delivery window</legend>
				<SettingToggle label="Enable a sliding-window limit" help="Holds messages when the configured total has been sent within the current window." checked={slidingWindow()} disabled={disabled()} onChange={setSlidingWindow} />
				<div class="settings-domain-grid">
					<InputField label="Messages per window" help="Maximum messages across all workers in one window." type="number" min={slidingWindow() ? '1' : '0'} max="10000000" required value={slidingWindowRate()} disabled={disabled() || !slidingWindow()} onInput={(event) => setSlidingWindowRate(event.currentTarget.value)} />
					<InputField label="Window duration" help="Examples: 30s, 15m, 2h, or 1h30m." value={slidingWindowDuration()} pattern={GO_DURATION_HTML_PATTERN} maxlength="64" required disabled={disabled() || !slidingWindow()} placeholder="1h" onInput={(event) => setSlidingWindowDuration(event.currentTarget.value)} />
				</div>
			</fieldset>
			<fieldset class="settings-card" disabled={disabled()}>
				<legend>Database query cache</legend>
				<SettingToggle label="Cache slow campaign queries" help="Periodically materializes slow query results. Coordinate this with PostgreSQL maintenance." checked={cacheSlowQueries()} disabled={disabled()} onChange={setCacheSlowQueries} />
				<InputField label="Refresh cron schedule" help="Standard five-field cron expression, interpreted by Listmonk." value={cacheSlowQueriesInterval()} maxlength="100" required disabled={disabled() || !cacheSlowQueries()} placeholder="0 3 * * *" onInput={(event) => setCacheSlowQueriesInterval(event.currentTarget.value)} />
			</fieldset>
			<Show when={props.canManage}><div class="form-actions"><button class="button" type="submit" disabled={props.pending}>{props.pending ? 'Saving…' : 'Save performance settings'}</button></div></Show>
		</form>
	);
}
