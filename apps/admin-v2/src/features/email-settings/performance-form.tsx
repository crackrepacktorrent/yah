import { Show, createSignal, untrack } from 'solid-js';
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
					<label class="form-field"><span>Concurrent workers</span><input type="number" min="1" max="10000" required value={concurrency()} onInput={(event) => setConcurrency(event.currentTarget.value)} /><small>Maximum workers that attempt sends simultaneously.</small></label>
					<label class="form-field"><span>Messages per second per worker</span><input type="number" min="1" max="100000" required value={messageRate()} onInput={(event) => setMessageRate(event.currentTarget.value)} /><small>Total ceiling is workers × this rate, subject to SMTP routing.</small></label>
					<label class="form-field"><span>Subscriber batch size</span><input type="number" min="1" max="100000" required value={batchSize()} onInput={(event) => setBatchSize(event.currentTarget.value)} /><small>Rows pulled from PostgreSQL per sending iteration.</small></label>
					<label class="form-field"><span>Maximum send errors</span><input type="number" min="0" max="100000" required value={maxSendErrors()} onInput={(event) => setMaxSendErrors(event.currentTarget.value)} /><small>Pauses a campaign at this count; zero never pauses automatically.</small></label>
				</div>
			</fieldset>
			<fieldset class="settings-card" disabled={disabled()}>
				<legend>Sliding delivery window</legend>
				<SettingToggle label="Enable a sliding-window limit" help="Holds messages when the configured total has been sent within the current window." checked={slidingWindow()} disabled={disabled()} onChange={setSlidingWindow} />
				<div class="settings-domain-grid">
					<label class="form-field"><span>Messages per window</span><input type="number" min={slidingWindow() ? '1' : '0'} max="10000000" required value={slidingWindowRate()} disabled={disabled() || !slidingWindow()} onInput={(event) => setSlidingWindowRate(event.currentTarget.value)} /><small>Maximum messages across all workers in one window.</small></label>
					<label class="form-field"><span>Window duration</span><input value={slidingWindowDuration()} pattern={GO_DURATION_HTML_PATTERN} maxlength="64" required disabled={disabled() || !slidingWindow()} placeholder="1h" onInput={(event) => setSlidingWindowDuration(event.currentTarget.value)} /><small>Examples: 30s, 15m, 2h, or 1h30m.</small></label>
				</div>
			</fieldset>
			<fieldset class="settings-card" disabled={disabled()}>
				<legend>Database query cache</legend>
				<SettingToggle label="Cache slow campaign queries" help="Periodically materializes slow query results. Coordinate this with PostgreSQL maintenance." checked={cacheSlowQueries()} disabled={disabled()} onChange={setCacheSlowQueries} />
				<label class="form-field"><span>Refresh cron schedule</span><input value={cacheSlowQueriesInterval()} maxlength="100" required disabled={disabled() || !cacheSlowQueries()} placeholder="0 3 * * *" onInput={(event) => setCacheSlowQueriesInterval(event.currentTarget.value)} /><small>Standard five-field cron expression, interpreted by Listmonk.</small></label>
			</fieldset>
			<Show when={props.canManage}><div class="form-actions"><button class="button" type="submit" disabled={props.pending}>{props.pending ? 'Saving…' : 'Save performance settings'}</button></div></Show>
		</form>
	);
}
